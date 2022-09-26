// @ts-check

import { SVG_ICONS } from "./svg.js";

export class ObjectInspector {
    #inputField
    #vscode
    #evalResultElement
    pageSize = 50;
    #objectView;
    constructor(vscode) {
        this.#inputField = this._renderInputField();
        this.#evalResultElement = this._renderEvalResultElement();
        this.#vscode = vscode;
        this._initializeView()
    }

    activate() {
        this.#objectView.style.display = 'block';
    }

    deactivate() {
        this.#objectView.style.display = 'none';
    }

    _renderInputField() {
        const inputField = document.createElement('textarea');
        inputField.rows = 1;
        inputField.className = 'inputField';
        const self = this;
        inputField.addEventListener('keydown', function (e) {
            switch (e.code) {
                case 'Backspace':
                    if (this.rows > 1 && this.value.endsWith('\n')) this.rows -= 1;
                    break;
                case 'Enter':
                    switch (true) {
                        case e.metaKey:
                            e.preventDefault();
                            self.removeCurEvalResult();
                            self.#vscode.postMessage({
                                command: 'evaluate',
                                args: {
                                    expression: this.value,
                                    pageSize: self.pageSize,
                                }
                            })
                            break;
                        default:
                            this.rows += 1;
                            break;
                    }
                    break;
            }
        })
        return inputField;
    }

    _renderEvalResultElement() {
        const evalResult = document.createElement('div');
        evalResult.className = 'evalResult';
        return evalResult;
    }

    _initializeView() {
        this.#objectView = document.createElement('div');
        this.#objectView.className = 'objectView';
        this.#objectView.appendChild(this.#inputField);
        this.#objectView.appendChild(this.#evalResultElement);
        document.body.appendChild(this.#objectView);
    }

    printEvalResult(data) {
        const visualization = document.createElement('select');
        visualization.name = 'visualization';
        visualization.className = 'visualization';
        const charts = document.createElement('div');
        data.objects.forEach((obj, idx) => {
            switch (obj.type) {
                case 'table':
                    const tableOpt = document.createElement('option');
                    tableOpt.value = 'table';
                    tableOpt.innerText = 'Table';
                    tableOpt.dataset.index = idx.toString();
                    visualization.appendChild(tableOpt);
                    break;
                case 'barChart':
                    const barChartOpt = document.createElement('option');
                    barChartOpt.value = 'bar';
                    barChartOpt.innerText = 'Bar Chart';
                    barChartOpt.dataset.index = idx.toString();
                    visualization.appendChild(barChartOpt);
                    break;
                case 'lineChart':
                    const lineChartOpt = document.createElement('option');
                    lineChartOpt.value = 'line'
                    lineChartOpt.innerText = 'Line Chart'
                    lineChartOpt.dataset.index = idx.toString();
                    visualization.appendChild(lineChartOpt);
                    break;
                case 'html':
                    const htmlOpt = document.createElement('option');
                    htmlOpt.value = 'html'
                    htmlOpt.innerText = 'HTML View'
                    htmlOpt.dataset.index = idx.toString();
                    visualization.appendChild(htmlOpt);
                    break;
                case 'image':
                    switch (obj.mimeType) {
                        case 'png':
                            const pngOpt = document.createElement('option');
                            pngOpt.value = 'png';
                            pngOpt.innerText = 'PNG Image';
                            pngOpt.dataset.index = idx.toString();
                            visualization.appendChild(pngOpt);
                            break;
                        case 'svg':
                            const svgOpt = document.createElement('option');
                            svgOpt.value = 'svg';
                            svgOpt.innerText = 'SVG Image';
                            svgOpt.dataset.index = idx.toString();
                            visualization.appendChild(svgOpt);
                            break;
                    }
                    break;
                case 'tree':
                    const treeOpt = document.createElement('option');
                    treeOpt.value = 'tree';
                    treeOpt.innerText = 'Tree View';
                    treeOpt.dataset.index = idx.toString();
                    visualization.appendChild(treeOpt);
                    break;
            }
        })
        visualization.addEventListener('change', (e) => {
            const idx = visualization.selectedIndex;
            const opt = visualization.options[idx];
            if (opt.dataset.index == undefined) return;
            if (!(e.target instanceof HTMLSelectElement)) return;
            const obj = data.objects[parseInt(opt.dataset.index)]
            switch (e.target.value) {
                case 'bar':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const barChart = this.createGraph(obj, 'bar');
                    charts.appendChild(barChart);
                    break;
                case 'line':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const lineChart = this.createGraph(obj, 'line');
                    charts.appendChild(lineChart);
                    break;
                case 'table':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const table = this.createTable(obj);
                    charts.appendChild(table);
                    if (obj.paginate !== undefined) {
                        const ul = this.paginate(obj.paginate.totalLen);
                        charts.appendChild(ul);
                    }
                    break;
                case 'html':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const htmlView = document.createElement('div');
                    htmlView.innerHTML = obj.data;
                    const style = document.createElement('style');
                    style.innerHTML = obj.css;
                    document.head.insertAdjacentElement('beforeend', style);
                    charts.appendChild(htmlView);
                    break;
                case 'png':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const pngView = document.createElement('div');
                    const png = document.createElement('img');
                    png.src = `data:image/png;base64,${obj.data}`;
                    pngView.appendChild(png);
                    charts.appendChild(pngView);
                    break;
                case 'svg':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const svgView = document.createElement('div');
                    svgView.innerHTML = obj.data
                    charts.appendChild(svgView);
                    break;
                case 'tree':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const treeView = document.createElement('div');
                    treeView.className = 'treeView';
                    console.log(obj.data)
                    const view = this.getTreeView(obj.data);
                    treeView.append(view);
                    charts.appendChild(treeView);
                    break;
            };
        });
        if (visualization.options.length >= 1) {
            this.#evalResultElement.appendChild(visualization);
            this.#evalResultElement.appendChild(charts);
            const event = new Event('change');
            visualization.dispatchEvent(event);
        }
    };

    getTreeView(data) {
        const ul = document.createElement('ul');
        data.forEach((obj) => {
            for (let [key, value] of Object.entries(obj)) {
                const li = document.createElement('li');
                if (value instanceof Array) {
                    const div = document.createElement('div');
                    div.className = 'nodeName';
                    const collapsible = document.createElement('div');
                    collapsible.classList.add('collapsible');
                    collapsible.innerHTML = SVG_ICONS.expanded;
                    div.appendChild(collapsible);
                    const text = document.createTextNode(key);
                    div.appendChild(text);
                    div.addEventListener('click', function () {
                        if (!(this.nextElementSibling instanceof HTMLUListElement)) return
                        const expanded = this.classList.toggle('collapsed');
                        if (expanded) {
                            this.nextElementSibling.style.display = 'none';
                        } else {
                            this.nextElementSibling.style.display = 'block';
                        }
                    })
                    li.appendChild(div);
                    const ul = this.getTreeView(value);
                    li.appendChild(ul);
                } else {
                    const text = `${key}: ${JSON.stringify(value)}`;
                    li.innerText = text;
                }
                ul.appendChild(li);
            }
        })
        return ul;
    }

    getText(ary) {
        const toString = Object.prototype.toString;
        for (const elem of ary) {
            if (toString.call(elem) === '[object String]') return elem
        }
        return ""
    }

    createGraph(params, type) {
        const chartView = document.createElement('div');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const uid = new Date().getTime().toString()
        const data = params.convData || params.data;
        const cfg = {
            type,
            data
        };
        // @ts-ignore
        const chartInstance = new Chart(
            ctx,
            cfg
        );
        chartView.appendChild(canvas);
        return chartView;
    }

    paginate(len) {
        const totalPage = Math.ceil(len / this.pageSize);
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        pagination.appendChild(prevBtn);
        for (let i = 1; i <= totalPage; i++) {
            const btn = document.createElement('button');
            btn.textContent = i.toString();
            btn.addEventListener('click', () => {
                this.removeCurEvalResult();
                const offset = (i - 1) * this.pageSize;
                this.#vscode.postMessage({
                    command: 'updateTable',
                    args: {
                        offset,
                        pageSize: this.pageSize
                    }
                })
            })
            pagination.appendChild(btn);
        }
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        pagination.appendChild(nextBtn);
        return pagination
    }

    removeCurEvalResult() {
        while (this.#evalResultElement.firstChild) {
            this.#evalResultElement.removeChild(this.#evalResultElement.firstChild);
        }
    }

    createTable(objects) {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        objects.columns.forEach((col) => {
            const text = document.createTextNode(col);
            const th = document.createElement('th');
            th.appendChild(text);
            tr.appendChild(th);
        })
        thead.appendChild(tr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody')
        objects.data.forEach((obj) => {
            const tr = document.createElement('tr');
            obj.forEach((val) => {
                const text = document.createTextNode(val);
                const td = document.createElement('td');
                td.appendChild(text);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        })
        table.appendChild(tbody);
        return table
    }
}
