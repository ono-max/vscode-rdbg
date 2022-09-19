// @ts-check

import { HistoryInspector } from './history.js';
import { ObjectInspector } from './object.js'

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    let objectTab;

    function createTab() {
        const tab = document.createElement('div');
        tab.className = 'tab';
        objectTab = document.createElement('button');
        objectTab.innerText = 'Object'
        objectTab.classList.add('tabContent');
        objectTab.addEventListener('click', () => {
            document.querySelectorAll('.tabContent').forEach((element) => {
                element.classList.remove('active');
            })
            objectTab.classList.add('active')
            historyInspector.deactivate();
            objectInspector.activate();
        })
        tab.appendChild(objectTab);
        const recordTab = document.createElement('button');
        recordTab.innerText = 'History';
        recordTab.classList.add('tabContent');
        recordTab.addEventListener('click', () => {
            document.querySelectorAll('.tabContent').forEach((element) => {
                element.classList.remove('active');
            })
            recordTab.classList.add('active')
            objectInspector.deactivate();
            historyInspector.activate();
        })
        tab.appendChild(recordTab);
        document.body.appendChild(tab);
    }

    Chart.defaults.color = getVSCodeColor('--vscode-editor-foreground');
    Chart.defaults.borderColor = getVSCodeColor('--vscode-editor-foreground');
    Chart.defaults.backgroundColor = getVSCodeColor('--vscode-editor-foreground');

    function getVSCodeColor(prop) {
        return getComputedStyle(document.body).getPropertyValue(prop);
    }


    createTab();

    const historyInspector = new HistoryInspector(vscode);
    historyInspector.deactivate();

    const objectInspector = new ObjectInspector(vscode);
    objectInspector.deactivate();

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'tableUpdated':
                objectTab.click();
                objectInspector.printEvalResult(data);
                break;
            case 'execLogsUpdated':
                historyInspector.printExecLogs(data.logs, data.currentLogIndex, data.totalLength)
                break;
        };
    });
}());
