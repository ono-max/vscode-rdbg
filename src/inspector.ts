import * as vscode from 'vscode';
import * as path from 'path';

const rdbgInspectorCmd = 'rdbgInspector.start';
const variablesReferenceKey = 'variablesReference';

export function enableRdbgInspector(ctx: vscode.ExtensionContext) {
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = rdbgInspectorCmd;
	statusBar.text = '$(search) rdbg inspector';

	const frameIdGetter = new FrameIdGetter

	const disp = [
		vscode.debug.onDidStartDebugSession(() => {
			statusBar.show();
		}),

		vscode.commands.registerCommand(rdbgInspectorCmd, () => {
			RdbgInspectorPanel.show(ctx.extensionPath, frameIdGetter)
		}),

		vscode.window.registerUriHandler({
			handleUri(uri: vscode.Uri) {
				const params = new URLSearchParams(uri.query);
				const variablesReference = params.get(variablesReferenceKey);
				if (variablesReference === null) {
					console.error('variablesReference is not found')
					return;
				}
				RdbgInspectorPanel.show(ctx.extensionPath, frameIdGetter, parseInt(variablesReference));
			}
		}),

		vscode.debug.onDidTerminateDebugSession(() => {
			statusBar.hide();
		}),

		vscode.languages.registerInlineValuesProvider('*', frameIdGetter),
	];

	ctx.subscriptions.concat(
		disp
	);
}

class RdbgInspectorPanel {
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
	private threadId: number = 0;
	private execLogs: any[] = [];
	private currentLogIndex: number = -1;
	private waitingExecLogs: boolean = false;
	private totalLength: number = 0;

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
					case 'execLogsUpdated':
						this.waitingExecLogs = false;
						this.threadId = event.body.threadId
						this.getExecLogs({ offset: 0, pageSize: 30 })
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
					// Object
					case 'variable':
						this.visualizeObjects(message.args)
						break;
					case 'evaluate':
						this.evalExpression(message.args);
						break;

					// History
					case 'customStepIn':
						if (this.waitingExecLogs) return
						this.focusNonWebViewEditor();
						this._session.customRequest(message.command, { 'times': message.times }).then(undefined, console.error)
						this.waitingExecLogs = true;
						break;
					case 'customStepBack':
						if (this.waitingExecLogs) return
						if (this.currentLogIndex === 0) {
							return
						}
						this.focusNonWebViewEditor();
						this._session.customRequest(message.command, { 'times': message.times }).then(undefined, console.error)
						this.waitingExecLogs = true;
						break;
					case 'startRecord':
					case 'stopRecord':
						this.focusNonWebViewEditor();
						this._session.customRequest(message.command).then(undefined, console.error);
						break;
					case 'searchExecLogs':
						this.searchExecLogs(message);
						break;
					case 'getExecLogs':
						this.getExecLogs(message)
						break;
				}
			})
		)
		this._panel.webview.html = this.getWebviewContent();
	}

	private async visualizeObjects(args: { offset: number, pageSize: number }) {
		let resp: any;
		try {
			resp = await this._session.customRequest('customVariable', {
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

		this._panel.webview.postMessage({
			command: 'objectInspected',
			content: resp,
		})
	}

	private async searchExecLogs(args: { keyword: string }) {
		let logs = []
		if (args.keyword === '') {
			logs = this.execLogs;
		} else {
			for (let i = 0; i < this.execLogs.length; i++) {
				if (this.execLogs[i].name.toLowerCase().indexOf(args.keyword.toLowerCase()) === -1) continue

				logs.push(this.execLogs[i])
			}
		}
		this._panel.webview.postMessage({
			command: 'execLogsUpdated',
			logs: logs,
			currentLogIndex: this.currentLogIndex,
			totalLength: this.totalLength
		})
	}

	private async getExecLogs(args: { offset: number, pageSize: number }) {
		let resp: any;
		try {
			resp = await this._session.customRequest('getExecLogs', {
				threadId: this.threadId,
				offset: args.offset,
				pageSize: args.pageSize
			})
		} catch (err) {
			console.error(err);
			return;
		}
		// TODO: Support multiple threads
		this.execLogs = resp.logs;
		this.currentLogIndex = resp.currentLogIndex;
		this.totalLength = resp.totalLength

		this._panel.webview.postMessage({
			command: 'execLogsUpdated',
			logs: resp.logs,
			currentLogIndex: resp.currentLogIndex,
			totalLength: resp.totalLength
		})
	}

	private async evalExpression(args: { expression: string, pageSize: number }) {
		if (args.expression === '') return;

		let resp: any;
		try {
			resp = await this._session.customRequest('customEvaluate', {
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

		this._panel.webview.postMessage({
			command: 'objectInspected',
			content: resp,
		})
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
				</head>
				<body>
						<script type="module" src=${scriptMainSrc}></script>
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
