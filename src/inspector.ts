import * as vscode from 'vscode';
import * as path from 'path';

export class RdbgInspectorPanel {
	private static currentPanel: vscode.WebviewPanel | undefined;
	public static async show(extensionPath: string, frameIdGetter: CurFrameIdGetter, variablesReference?: number) {
		if (RdbgInspectorPanel.currentPanel) {
			const viewColumn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
			return RdbgInspectorPanel.currentPanel.reveal(viewColumn);
		}

		this.waitSession().then((session) => {
			const panel = new RdbgInspectorPanel(extensionPath, frameIdGetter, session, variablesReference);
			panel.reveal();
		})
			.catch((e) => {
				console.error(e)
			});
	}

	private static waitSession(): Promise<vscode.DebugSession> {
		let counter: number = 0
		return new Promise((resolve, reject) => {
			const id = setInterval(() => {
				if (counter > 5) {
					clearInterval(id);
					reject(new Error("failed to wait session"))
				}
				if (vscode.debug.activeDebugSession !== undefined) {
					clearInterval(id);
					resolve(vscode.debug.activeDebugSession);
				}
				counter += 1
			}, 1000);
		})
	}

	private readonly _extensionPath: string;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _session: vscode.DebugSession;
	private readonly _frameIdGetter: CurFrameIdGetter;

	private disposables: vscode.Disposable[] = [];
	private variablesReference: number = 0;

	private constructor(extensionPath: string, frameIdGetter: CurFrameIdGetter, session: vscode.DebugSession, variablesReference?: number) {
		const currentPanel = vscode.window.createWebviewPanel('rdbg', 'rdbg inspector', vscode.ViewColumn.Beside, {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))],
			retainContextWhenHidden: true
		});
		RdbgInspectorPanel.currentPanel = currentPanel;
		this._extensionPath = extensionPath;
		this._panel = currentPanel;
		this._session = session;
		this._frameIdGetter = frameIdGetter;
		if (variablesReference !== undefined) {
			this.variablesReference = variablesReference;
			this.visualizeObjects({ offset: 0, pageSize: 30 });
		}

		this.registerDisposable(
			vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
				let records: any[] = [];
				switch (event.event) {
					case 'recordsUpdated':
						records = records.concat(event.body.records);
						if (event.body.fin) {
							const logIndex: number = event.body.logIndex;
							this.updateWebview(records, logIndex);
							records = []
						}
						break;
				}
			})
		)

		this._panel.onDidDispose(() => {
			this.disposables.forEach(disp => {
				disp.dispose();
			})
			this._panel.dispose();
		})
	}

	private reveal() {
		this.registerDisposable(
			this._panel.webview.onDidReceiveMessage((message) => {
				switch (message.command) {
					case 'updateTable':
						this.visualizeObjects(message.args)
						break;
					case 'evaluate':
						this.evalExpression(message.args);
						break;
					case 'goTo':
					case 'goBackTo':
						this.focusNonWebViewEditor();
						this._session.customRequest(message.command, { 'times': message.times }).then(undefined, console.error)
						break;
					case 'startRecord':
					case 'stopRecord':
						this.focusNonWebViewEditor();
						this._session.customRequest(message.command).then(undefined, console.error);
						break;
				}
			})
		)
		this._panel.webview.html = this.getWebviewContent();
	}

	private async visualizeObjects(args: { offset: number, pageSize: number }) {
		let resp: any;
		try {
			resp = await this._session.customRequest('getVisObjects', {
				variablesReference: this.variablesReference,
				keywords: {
					offset: args.offset,
					pageSize: args.pageSize,
				}
			})
		} catch (err) {
			console.error(err)
			return;
		}

		const data = await this.simplifyData(resp);
		this._panel.webview.postMessage({
			command: 'tableUpdated',
			objects: data,
		})
	}

	private async evalExpression(args: { expression: string, pageSize: number }) {
		if (args.expression === '') return;

		let resp: any;
		try {
			resp = await this._session.customRequest('evaluateVisObjects', {
				expression: args.expression,
				frameId: this._frameIdGetter.frameId,
				keywords: {
					offset: 0,
					pageSize: args.pageSize
				}
			})
		} catch (err) {
			console.error(err)
			return;
		}

		this.variablesReference = resp.variablesReference;

		const data = await this.simplifyData(resp);
		this._panel.webview.postMessage({
			command: 'tableUpdated',
			objects: data,
		})
	}

	private async simplifyData(resp: { data: { [key: string]: any; type: string; data: any[]; }[]; }) {
		const toString = Object.prototype.toString;

		resp.data.forEach((obj: { type: string, data: any[], [key: string]: any }) => {
			switch (obj.type) {
				case 'table':
					const row = obj.data[0];
					switch (toString.call(row)) {
						case '[object Object]':
							obj.data = obj.data.map((row) => {
								return Object.values(row)
							})
							if (obj.columns === undefined) {
								obj.columns = Object.keys(row);
							}
							break;
						default:
							obj.data = obj.data.map((row, idx) => {
								return [idx.toString(), row]
							})
							obj.columns = ['index', 'element']
							break;
					}
					break;
				case 'barChart':
				case 'lineChart':
					const firstElem = obj.data[0];
					const datasets = [];
					const labels: string[] = [];
					switch (toString.call(firstElem)) {
						case '[object Object]':
							if (obj.xAxisKeys instanceof Array) {
								const key = obj.xAxisKeys[0];
								for (const elem of obj.data) {
									labels.push(elem[key].toString());
								}
								obj.labels = labels;
							} else {
								for (let i = 0; i < obj.data.length; i++) {
									labels[i] = '';
								}
							}
							if (obj.yAxisKeys instanceof Array) {
								for (const key of obj.yAxisKeys) {
									const data = [];
									for (const elem of obj.data) {
										data.push(elem[key]);
									}
									datasets.push(
										{
											label: key.toString(),
											data,
											backgroundColor: this.getRandColor()
										}
									)
								}
							}
							obj.convData = {
								labels,
								datasets
							}
							break;
						case '[object Array]':
							for (let i = 0; i < obj.data.length; i++) {
								labels[i] = '';
							}
							const yAxisKeys: number[] = []
							for (let i = 0; i < firstElem.length; i++) {
								yAxisKeys.push(i);
							}
							for (const key of yAxisKeys) {
								const data = [];
								for (const elem of obj.data) {
									data.push(elem[key]);
								}
								datasets.push(
									{
										label: key.toString(),
										data,
										backgroundColor: this.getRandColor()
									}
								)
							}
							obj.convData = {
								labels,
								datasets
							}
							break;
						case '[object Number]':
							for (let i = 0; i < obj.data.length; i++) {
								labels[i] = '';
							}
							datasets.push(
								{
									data: obj.data,
									backgroundColor: this.getRandColor()
								}
							)
							obj.convData = {
								labels,
								datasets
							}
							break;
					}
					break;
			}
		})
		return resp.data;
	}

	private focusNonWebViewEditor() {
		let uri: vscode.Uri | undefined;
		for (let editor of vscode.window.visibleTextEditors) {
			if (editor.document.uri !== undefined) {
				uri = editor.document.uri;
				break;
			}
		}
		if (uri !== undefined) {
			vscode.workspace.openTextDocument(uri).then(doc => {
				vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
			})
		}
	}

	private getRandColor() {
		const r = Math.floor(Math.random() * 256)
		const g = Math.floor(Math.random() * 256)
		const b = Math.floor(Math.random() * 256)
		return `rgba(${r}, ${g}, ${b}, 0.5)`
	}

	private updateWebview(records: any[], logIndex: number) {
		if (records.length === 0) {
			return
		}
		this._panel.webview.postMessage({
			command: 'update',
			records: records,
			logIndex
		})
	};

	private registerDisposable(disp: vscode.Disposable) {
		this.disposables.push(disp);
	}

	private getWebviewContent() {
		const styleMainUri = vscode.Uri.file(path.join(this._extensionPath, 'media', 'main.css'));
		const styleMainSrc = this._panel.webview.asWebviewUri(styleMainUri);
		const styleVisualizerUri = vscode.Uri.file(path.join(this._extensionPath, 'media', 'visualizer.css'));
		const styleVisualizerSrc = this._panel.webview.asWebviewUri(styleVisualizerUri);
		const scriptMainUri = vscode.Uri.file(path.join(this._extensionPath, 'media', 'main.js'));
		const scriptMainSrc = this._panel.webview.asWebviewUri(scriptMainUri);
		return `
			<!DOCTYPE html>
			<html lang="en">
				<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">

						<title>Object Visualizer</title>
						<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
						<link href="${styleMainSrc}" rel="stylesheet"></link>
						<link href="${styleVisualizerSrc}" rel="stylesheet"></link>
				</head>
				<body>
						<script src=${scriptMainSrc}></script>
				</body>
			</html>`;
	}
}

export class FrameIdGetter implements vscode.InlineValuesProvider, CurFrameIdGetter {
	frameId: number = 0;
	provideInlineValues(document: vscode.TextDocument, viewPort: vscode.Range, context: vscode.InlineValueContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlineValue[]> {
		this.frameId = context.frameId;
		return []
	}
}

interface CurFrameIdGetter {
	readonly frameId: number;
}
