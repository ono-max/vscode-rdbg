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

    printEvalResult(content) {
        const visualization = document.createElement('select');
        visualization.name = 'visualization';
        visualization.className = 'visualization';
        const charts = document.createElement('div');
        for (const mimeType of Object.keys(content.data)) {
            switch (mimeType) {
                case 'application/rdbg.table+json':
                    const tableOpt = document.createElement('option');
                    tableOpt.value = 'table';
                    tableOpt.innerText = 'Table';
                    tableOpt.dataset.mimeType = mimeType;
                    visualization.appendChild(tableOpt);
                    break;
                case 'application/rdbg.barchart+json':
                    const barChartOpt = document.createElement('option');
                    barChartOpt.value = 'bar';
                    barChartOpt.innerText = 'Bar Chart';
                    barChartOpt.dataset.mimeType = mimeType;
                    visualization.appendChild(barChartOpt);
                    break;
                case 'application/rdbg.linechart+json':
                    const lineChartOpt = document.createElement('option');
                    lineChartOpt.value = 'line'
                    lineChartOpt.innerText = 'Line Chart'
                    lineChartOpt.dataset.mimeType = mimeType;
                    visualization.appendChild(lineChartOpt);
                    break;
                case 'text/plain':
                    const textOpt = document.createElement('option');
                    textOpt.value = 'text';
                    textOpt.innerText = 'Text';
                    textOpt.dataset.mimeType = mimeType;
                    visualization.appendChild(textOpt);
                    break;
                case 'html':
                    const htmlOpt = document.createElement('option');
                    htmlOpt.value = 'html'
                    htmlOpt.innerText = 'HTML View'
                    htmlOpt.dataset.mimeType = mimeType;
                    visualization.appendChild(htmlOpt);
                    break;
                case 'image':
                    switch (obj.mimeType) {
                        case 'png':
                            const pngOpt = document.createElement('option');
                            pngOpt.value = 'png';
                            pngOpt.innerText = 'PNG Image';
                            pngOpt.dataset.mimeType = mimeType;
                            visualization.appendChild(pngOpt);
                            break;
                        case 'svg':
                            const svgOpt = document.createElement('option');
                            svgOpt.value = 'svg';
                            svgOpt.innerText = 'SVG Image';
                            svgOpt.dataset.mimeType = mimeType;
                            visualization.appendChild(svgOpt);
                            break;
                    }
                    break;
                case 'application/rdbg.tree+json':
                    const treeOpt = document.createElement('option');
                    treeOpt.value = 'tree';
                    treeOpt.innerText = 'Tree View';
                    treeOpt.dataset.mimeType = mimeType;
                    visualization.appendChild(treeOpt);
                    break;
            }
        }

        visualization.addEventListener('change', (e) => {
            const idx = visualization.selectedIndex;
            const opt = visualization.options[idx];
            if (opt.dataset.mimeType == undefined) return;
            if (!(e.target instanceof HTMLSelectElement)) return;
            const mimeType = opt.dataset.mimeType;
            switch (e.target.value) {
                case 'bar':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const barChart = this.createGraph(content.data[mimeType], content.metadata[mimeType], 'bar');
                    charts.appendChild(barChart);
                    break;
                case 'line':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const lineChart = this.createGraph(content.data[mimeType], content.metadata[mimeType], 'line');
                    charts.appendChild(lineChart);
                    break;
                case 'table':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const table = this.createTable(content.data[mimeType], content.metadata[mimeType]);
                    charts.appendChild(table);
                    const paginate = content.metadata[mimeType].paginate
                    if (paginate !== undefined) {
                        const ul = this.paginate(paginate.totalLen);
                        charts.appendChild(ul);
                    }
                    break;
                case 'text':
                    while (charts.firstChild) {
                        charts.removeChild(charts.firstChild);
                    }
                    const textView = document.createElement('div');
                    textView.innerText = content.data[mimeType];
                    charts.appendChild(textView);
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
                    const treedata = JSON.parse(content.data[mimeType]);
                    const view = this.getTreeView(treedata, content.metadata[mimeType]);
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

    getTreeView(data, metadata) {
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

    createGraph(rawdata, metadata, type) {
        const data = this._simplifyChartData(rawdata, metadata);
        const chartView = document.createElement('div');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
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

    _simplifyChartData(rawdata, metadata) {
        const toString = Object.prototype.toString;
        const firstElem = rawdata[0];
        const datasets = [];
        const labels = [];
        switch (toString.call(firstElem)) {
            case '[object Object]':
                if (metadata.xAxisKeys instanceof Array) {
                    const key = metadata.xAxisKeys[0];
                    for (const elem of rawdata) {
                        labels.push(elem[key].toString());
                    }
                    metadata.labels = labels;
                } else {
                    for (let i = 0; i < rawdata.length; i++) {
                        labels[i] = '';
                    }
                }
                if (metadata.yAxisKeys instanceof Array) {
                    for (const key of metadata.yAxisKeys) {
                        const data = [];
                        for (const elem of rawdata) {
                            data.push(elem[key]);
                        }
                        datasets.push(
                            {
                                label: key.toString(),
                                data,
                                backgroundColor: this._getRandColor()
                            }
                        )
                    }
                }
                return {
                    labels,
                    datasets
                }
            case '[object Array]':
                for (let i = 0; i < rawdata.length; i++) {
                    labels[i] = '';
                }
                const yAxisKeys = []
                for (let i = 0; i < firstElem.length; i++) {
                    yAxisKeys.push(i);
                }
                for (const key of yAxisKeys) {
                    const data = [];
                    for (const elem of rawdata) {
                        data.push(elem[key]);
                    }
                    datasets.push(
                        {
                            label: key.toString(),
                            data,
                            backgroundColor: this._getRandColor()
                        }
                    )
                }
                return {
                    labels,
                    datasets
                }
            case '[object Number]':
                for (let i = 0; i < rawdata.length; i++) {
                    labels[i] = '';
                }
                datasets.push(
                    {
                        data: rawdata,
                        backgroundColor: this._getRandColor()
                    }
                )
                return {
                    labels,
                    datasets
                }
        }
    }

    _getRandColor() {
        const r = Math.floor(Math.random() * 256)
        const g = Math.floor(Math.random() * 256)
        const b = Math.floor(Math.random() * 256)
        return `rgba(${r}, ${g}, ${b}, 0.5)`
    }

    _simplifyTableData(rawdata, metadata) {
        const row = rawdata[0];
        let data;
        let columns;
        switch (toString.call(row)) {
            case '[object Object]':
                data = rawdata.map((row) => {
                    return Object.values(row)
                })
                columns = metadata.columns || Object.keys(row);
                return {
                    data,
                    columns
                }
            default:
                data = rawdata.map((row, idx) => {
                    return [idx.toString(), row]
                })
                columns = ['index', 'element']
                return {
                    data,
                    columns
                }
        }
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
                    command: 'variable',
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

    createTable(rawdata, metadata) {
        const data = this._simplifyTableData(rawdata, metadata);
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        data.columns.forEach((col) => {
            const text = document.createTextNode(col);
            const th = document.createElement('th');
            th.appendChild(text);
            tr.appendChild(th);
        })
        thead.appendChild(tr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody')
        data.data.forEach((obj) => {
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
