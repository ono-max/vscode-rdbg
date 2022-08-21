// @ts-check

const SVG_ICONS = {
    goTo: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
               <path d="M 0 2 L 8 8 L 0 14 Z" />
               <path d="M 8 2 L 16 8 L 8 14 Z" />
            </svg>
        `,
    goBackTo: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M 16 14 L 8 8 L 16 2 Z" />
                <path d="M 8 14 L 0 8 L 8 2 Z" />
            </svg>
        `,
    startRecord: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg" class="start">
                <circle cx="50%" cy="50%" r="7.5" fill="transparent" />
                <circle cx="50%" cy="50%" r="4" fill="transparent" />
            </svg>
        `,
    stopRecord: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg" class="stop">
                <circle cx="50%" cy="50%" r="7.5" fill="transparent" />
                <rect x="32%" y="32%" width="6" height="6" />
            </svg>
        `,
    expanded: `
            <svg version="1.1" width="12" xmlns="http://www.w3.org/2000/svg">
                <path d="M 1 5 L 6 9" />
                <path d="M 6 9 L 11 5" />
            </svg>
    `,
    collapsed: `
            <svg version="1.1" width="12" height="14" xmlns="http://www.w3.org/2000/svg">
                <path d="M 4 2 L 8 7" />
                <path d="M 8 7 L 4 12" />
            </svg>
    `
};

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    let eventTriggered;

    const space = "\xA0"
    const rbenvRegexp = /\.rbenv\/versions\/\d\.\d\.\d\/lib\//
    const gemRegexp = /ruby\/gems\/\d.\d.\d\/gems\//

    class EventListenerFactory {
        pageSize = 50;
        /**
         * @type {EventListenerFactory}
         */
        static historyView;

        static async activate(records, logIdx, recRenderer, viewRenderer) {
            if (EventListenerFactory.historyView) {
                EventListenerFactory.historyView.update(records, logIdx);
                return
            }
            EventListenerFactory.historyView = new EventListenerFactory(records, logIdx, recRenderer, viewRenderer)
            EventListenerFactory.historyView.update(records, logIdx);
        }

        curPage = 1;
        maxPage = 1;

        /**
         * @param {any} [records]
         * @param {any} [logIdx]
         * @param {recordRenderer} [recRenderer]
         * @param {HistoryViewRenderer} [viewRenderer]
         */
        constructor(records, logIdx, recRenderer, viewRenderer) {
            if (viewRenderer === undefined || recRenderer === undefined) {
                return;
            }
            this.curAllRecs = records;
            this.logIndex = logIdx;
            /**
             * @type {recordRenderer}
             */
            this.recRenderer = recRenderer;
            /**
             * @type {HistoryViewRenderer}
             */
            this.viewRendrer = viewRenderer;
            this._addStepBackListener();
            this._addStepInListener();
            this._addPrevPageListener();
            this._addNextPageListener();
            this._addFilterListener();
        }

        _addStepBackListener() {
            const self = this;
            this.viewRendrer.goBackToButton.addEventListener('click', function () {
                if (self.viewRendrer.recordButton.classList.contains('disabled')) {
                    return
                }
                const lastRec = self.curAllRecs[self.curAllRecs.length - 1]
                if (lastRec.begin_cursor + lastRec.locations.length <= self.logIndex) {
                    return
                }
                self.viewRendrer.disableControlButtons();
                self.viewRendrer.recordButton.classList.add('disabled');
                vscode.postMessage({
                    command: 'goBackTo',
                    times: 1
                })
            })
        }

        _addStepInListener() {
            const self = this;
            this.viewRendrer.goToButton.addEventListener('click', function () {
                if (self.viewRendrer.recordButton.classList.contains('disabled')) {
                    return
                }
                const lastRec = self.curAllRecs[self.curAllRecs.length - 1]
                if (lastRec.begin_cursor + lastRec.locations.length <= self.logIndex) {
                    return
                }
                self.viewRendrer.disableControlButtons();
                self.viewRendrer.recordButton.classList.add('disabled');
                vscode.postMessage({
                    command: 'goTo',
                    times: 1
                })
            })
        }

        _addPrevPageListener() {
            const self = this;
            this.viewRendrer.prevPageButton.addEventListener('click', function () {
                if (self.curPage < 2) {
                    return;
                }
                self.curPage -= 1
                const end = self.curAllRecs.length - (self.maxPage - self.curPage) * self.pageSize;
                let start = end - self.pageSize;
                if (start < 0) {
                    start = 0;
                }
                self.recRenderer.activate(self.curAllRecs.slice(start, end))
                // TODO: enableAvailCmdと同じような感じにする
                self.viewRendrer.prevPageButton.disabled = false;
                self.viewRendrer.nextPageButton.disabled = false;
                if (self.curPage === self.maxPage) {
                    self.viewRendrer.nextPageButton.disabled = true;
                }
                if (self.curPage === 1) {
                    self.viewRendrer.prevPageButton.disabled = true;
                }
            })
        }

        _addNextPageListener() {
            const self = this;
            this.viewRendrer.nextPageButton.addEventListener('click', function () {
                if (self.curPage === self.maxPage) {
                    return;
                }
                self.curPage += 1;
                const end = self.curAllRecs.length - (self.maxPage - self.curPage) * self.pageSize;
                let start = end - self.pageSize;
                if (start < 0) {
                    start = 0;
                }
                self.recRenderer.activate(self.curAllRecs.slice(start, end))
                self.viewRendrer.prevPageButton.disabled = false;
                self.viewRendrer.nextPageButton.disabled = false;
                if (self.curPage === self.maxPage) {
                    self.viewRendrer.nextPageButton.disabled = true;
                }
                if (self.curPage === 1) {
                    self.viewRendrer.prevPageButton.disabled = true;
                }
            })
        }

        _addFilterListener() {
            this.viewRendrer.filterInput.addEventListener('input', (e) => {
                if (!(e.target instanceof HTMLInputElement)) return;

                let records = []
                if (e.target.value === '') {
                    records = this._findTargetRecords();
                } else {
                    for (let i = 0; i < this.curAllRecs.length; i++) {
                        if (this.curAllRecs[i].name.toLowerCase().indexOf(e.target.value.toLowerCase()) === -1) continue

                        records.push(this.curAllRecs[i])
                    }
                }
                this.recRenderer.activate(records);
            })
        }

        async update(records, logIdx) {
            this.curAllRecs = records;
            this.logIndex = logIdx;
            this.viewRendrer.recordButton.innerHTML = SVG_ICONS.stopRecord;
            this.maxPage = Math.ceil(this.curAllRecs.length / this.pageSize);
            const targetRec = this._findTargetRecords()
            this.recRenderer.activate(targetRec);
            this.viewRendrer.prevPageButton.style.display = 'block';
            this.viewRendrer.nextPageButton.style.display = 'block';
            this.viewRendrer.prevPageButton.disabled = false;
            this.viewRendrer.nextPageButton.disabled = false;
            if (this.curPage === this.maxPage) {
                this.viewRendrer.nextPageButton.disabled = true;
            }
            if (this.curPage === 1) {
                this.viewRendrer.prevPageButton.disabled = true;
            }
            this._enableAvailCmdButtons();
        };

        _enableAvailCmdButtons() {
            this.viewRendrer.recordButton.classList.remove('disabled');
            if (this.logIndex !== 0) {
                this.viewRendrer.goBackToButton.classList.remove('disabled');
            }
            const lastRec = this.curAllRecs[this.curAllRecs.length - 1]
            if (lastRec.begin_cursor + lastRec.locations.length > this.logIndex) {
                this.viewRendrer.goToButton.classList.remove('disabled');
            }
        }

        _findTargetRecords() {
            const lastRec = this.curAllRecs[this.curAllRecs.length - 1];
            this.curPage = this.maxPage;
            if (this.logIndex > lastRec.begin_cursor + lastRec.locations.length) {
                return this.curAllRecs.slice(-this.pageSize)
            }
            let remainRec = this.curAllRecs
            while (remainRec.length > 1) {
                const records = remainRec.slice(-this.pageSize)
                const firstRec = records[0];
                const lastRec = records[records.length - 1];
                const start = firstRec.begin_cursor;
                const end = lastRec.begin_cursor + lastRec.locations.length;
                if (this.logIndex >= start && this.logIndex <= end) {
                    return records
                }

                this.curPage -= 1
                remainRec = this.curAllRecs.slice(0, -this.pageSize)
            }
            return remainRec
        }
    }

    class HistoryViewRenderer {
        #recordBtn;
        #goBackToBtn;
        #goToBtn;
        #prevPageBtn;
        #nextPageBtn;
        #input;
        #recordView
        constructor() {
            this.#recordBtn = this._renderRecordButton();
            this.#goBackToBtn = this._renderStepBackButton();
            this.#goToBtn = this._renderStepInButton();
            this.#prevPageBtn = this._renderPrevPageButton();
            this.#nextPageBtn = this._renderNextPageButton();
            this.#input = this._renderFilterInput();
            this._initializeView();
        }

        activate() {
            this.#recordView.style.display = 'block';
        }

        deactivate() {
            this.#recordView.style.display = 'none';
        }

        get recordButton() {
            return this.#recordBtn;
        }

        get goBackToButton() {
            return this.#goBackToBtn;
        }

        get goToButton() {
            return this.#goToBtn;
        }

        get prevPageButton() {
            return this.#prevPageBtn;
        }

        get nextPageButton() {
            return this.#nextPageBtn;
        }

        get filterInput() {
            return this.#input;
        }

        disableControlButtons() {
            this.#goBackToBtn.classList.add('disabled');
            this.#goToBtn.classList.add('disabled');
        }

        _renderRecordButton() {
            const recordBtn = document.createElement('li');
            recordBtn.innerHTML = SVG_ICONS.startRecord;
            recordBtn.className = 'recordButton';
            recordBtn.addEventListener('click', function () {
                if (this.querySelector('.start') !== null) {
                    this.innerHTML = SVG_ICONS.stopRecord;
                    vscode.postMessage({
                        command: 'startRecord'
                    })
                } else {
                    this.innerHTML = SVG_ICONS.startRecord;
                    vscode.postMessage({
                        command: 'stopRecord'
                    })
                }
            })
            return recordBtn;
        }

        _renderStepInButton() {
            const goToBtn = document.createElement('li');
            goToBtn.innerHTML = SVG_ICONS.goTo;
            goToBtn.className = 'goToButton';
            return goToBtn;
        }

        _renderStepBackButton() {
            const goBackToBtn = document.createElement('li');
            goBackToBtn.innerHTML = SVG_ICONS.goBackTo;
            goBackToBtn.className = 'goBackToButton';
            return goBackToBtn;
        }

        _renderPrevPageButton() {
            const prevBtn = document.createElement('button');
            prevBtn.innerText = 'Previous';
            prevBtn.className = 'prevPageButton'
            return prevBtn;
        }

        _renderNextPageButton() {
            const nextBtn = document.createElement('button');
            nextBtn.innerText = 'Next';
            nextBtn.className = 'nextPageButton'
            return nextBtn;
        }

        _renderFilterInput() {
            const input = document.createElement('input');
            input.className = 'filterInput'
            return input;
        }

        _initializeView() {
            this.#recordView = document.createElement('div');
            this.#recordView.className = 'recordView';
            const ul = document.createElement('ul');
            ul.classList.add('debugButtons');
            this.#goBackToBtn.classList.add('disabled');
            this.#goToBtn.classList.add('disabled');
            ul.appendChild(this.#recordBtn);
            ul.appendChild(this.#goBackToBtn);
            ul.appendChild(this.#goToBtn);
            this.#recordView.appendChild(ul);
            this.#recordView.appendChild(this.#input);
            const frames = document.createElement('div');
            frames.className = 'frames';
            this.#recordView.appendChild(frames);
            const pageBtns = document.createElement('div');
            pageBtns.className = 'PageButtons';
            this.#prevPageBtn.style.display = 'none';
            this.#nextPageBtn.style.display = 'none';
            pageBtns.appendChild(this.prevPageButton);
            pageBtns.appendChild(this.#nextPageBtn)
            this.#recordView.appendChild(pageBtns);
            this.deactivate();
            document.body.appendChild(this.#recordView);
        }
    }

    class recordRenderer {
        constructor(records) {
            this.curAllRec = records;
            this.frameContainer = document.querySelector('.frames');
            const lastRecord = records[records.length - 1];
            this.currentStoppedCursor = lastRecord.begin_cursor + lastRecord.locations.length;
        }

        activate(targetRec) {
            this._resetView();

            const minDepth = this._findMinDepth(targetRec);
            targetRec.forEach((record) => {
                const div = document.createElement('div');
                div.classList.add('frame');
                div.setAttribute('data-index', record.index);
                const collapsible = document.createElement('div');
                collapsible.classList.add('collapsible');
                collapsible.innerHTML = SVG_ICONS.collapsed;
                div.appendChild(collapsible);
                const depth = record.frame_depth - minDepth
                div.style.paddingLeft = `${depth}em`;
                div.setAttribute('data-depth', depth.toString())
                const name = document.createTextNode(record.name);
                div.appendChild(name);
                const args = this._getArgs(record.args);
                div.appendChild(args);
                this._addShowLocationsListener(div);
                // @ts-ignore
                this.frameContainer.appendChild(div);
                record.locations.forEach((loc) => {
                    if (loc.current) {
                        div.click()
                    }
                })
            })
        }

        _addShowLocationsListener(element) {
            const self = this;
            element.addEventListener('click', function () {
                const result = this.classList.toggle('locationShowed');
                const collapsible = this.querySelector('.collapsible');
                if (!result) {
                    collapsible.innerHTML = SVG_ICONS.collapsed;
                    this.nextElementSibling.remove();
                    return;
                }
                collapsible.innerHTML = SVG_ICONS.expanded
                const recordIdx = this.dataset.index;
                const record = self.curAllRec[recordIdx];
                let cursor = record.begin_cursor;
                const parent = document.createElement('div')
                const depth = parseInt(this.dataset.depth) + 2
                record.locations.forEach((loc) => {
                    const div = document.createElement('div');
                    div.classList.add('location');
                    div.setAttribute('data-cursor', cursor);
                    let name = loc.name.replace(rbenvRegexp, '');
                    name = name.replace(gemRegexp, '');
                    div.style.paddingLeft = `${depth}em`;
                    self._createTableData(name, div);
                    self._addStepListener(div)
                    if (loc.current) {
                        div.classList.add('stopped');
                        self.currentStoppedCursor = cursor;
                    }
                    parent.appendChild(div);
                    cursor += 1;
                })
                this.insertAdjacentElement('afterend', parent)
            })
        }

        _findMinDepth(records) {
            let min = records[0].frame_depth
            for (let i = 1; i < records.length; i++) {
                const depth = records[i].frame_depth
                if (min > depth) {
                    min = depth;
                }
            }
            return min
        }

        _getArgs(args) {
            const span = document.createElement('span');
            span.classList.add('args')
            if (args === null) return span
            let data = ""
            args.forEach((arg) => {
                data += `${space}${arg.name}=${arg.value}`
            })
            const text = document.createTextNode(data);
            span.appendChild(text);
            return span
        }

        _resetView() {
            // @ts-ignore
            this.frameContainer.innerHTML = '';
        }

        _createTableData(data, parent) {
            const text = document.createTextNode(data);
            parent.appendChild(text);
        }

        _addStepListener(element) {
            const self = this;
            element.addEventListener('click', function () {
                if (this.classList.contains('stopped') || eventTriggered) {
                    return;
                }

                eventTriggered = true;

                let times = self.currentStoppedCursor - parseInt(this.dataset.cursor);
                var command;
                if (times > 0) {
                    command = 'goBackTo';
                } else {
                    command = 'goTo';
                    times = Math.abs(times);
                }
                vscode.postMessage({
                    command: command,
                    times: times
                })
            })
        }
    }

    let crtXKey = 'id';
    const pageSize = 30;

    function createTable(objects) {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        const headers = Object.keys(objects[0])
        headers.forEach((header) => {
            const text = document.createTextNode(header);
            const th = document.createElement('th');
            th.appendChild(text);
            tr.appendChild(th);
        })
        thead.appendChild(tr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody')
        objects.forEach((obj) => {
            const tr = document.createElement('tr');
            Object.values(obj).forEach((val) => {
                const text = document.createTextNode(val);
                const td = document.createElement('td');
                td.appendChild(text);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        })
        table.appendChild(tbody);
        tableView.appendChild(table);
    }

    function pagination(len) {
        const totalPage = Math.ceil(len / pageSize);
        const ul = document.createElement('ul')
        for (let i = 1; i <= totalPage; i++) {
            const li = document.createElement('li');
            const pageNum = i.toString();
            li.textContent = pageNum;
            li.setAttribute('data-page-num', pageNum)
            li.addEventListener('click', getNewPage)
            ul.appendChild(li);
        }
        tableView.appendChild(ul);
    }

    async function getNewPage() {
        const pageNum = this.dataset.pageNum;
        const offset = (pageNum - 1) * pageSize;
        vscode.postMessage({
            command: 'updateTable',
            args: {
                offset,
                pageSize
            }
        })
    }

    function update(data) {
        const visualization = document.createElement('select');
        visualization.name = 'visualization';
        visualization.className = 'visualization';
        data.objects.forEach((obj, idx) => {
            switch (obj.type) {
                case 'table':
                    const tableOpt = document.createElement('option');
                    tableOpt.value = 'table';
                    tableOpt.innerText = 'Table';
                    tableOpt.dataset.index = idx.toString();
                    visualization.appendChild(tableOpt);
                    createTable(obj.params.data);
                    pagination(obj.params.len);
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
                    const htmlView = document.createElement('div');
                    htmlView.innerHTML = obj.params.data;
                    const style = document.createElement('style');
                    style.innerHTML = obj.params.css;
                    document.head.insertAdjacentElement('beforeend', style);
                    replView.appendChild(htmlView);
                    break;
                case 'png':
                    const svgView = document.createElement('div');
                    const img = document.createElement('img');
                    img.src = `data:image/png;base64,${obj.params.data}`;
                    svgView.appendChild(img);
                    replView.appendChild(svgView);
                    break;
            }
        })
        visualization.addEventListener('change', (e) => {
            const idx = visualization.selectedIndex;
            const opt = visualization.options[idx];
            if (opt.dataset.index == undefined) return;
            switch (e.target.value) {
                case 'bar':
                    tableView.style.display = 'none';
                    createGraph(data.objects[parseInt(opt.dataset.index)].params, 'bar');
                    chartView.style.display = 'block';
                    break;
                case 'line':
                    tableView.style.display = 'none';
                    createGraph(data.objects[parseInt(opt.dataset.index)].params, 'line');
                    chartView.style.display = 'block';
                    break;
                case 'table':
                    tableView.style.display = 'block'
                    chartView.style.display = 'none';
                    break;
            };
        });
        if (visualization.options.length > 1) replView.appendChild(visualization);
        if (data.newInput) {
            const replInput = document.createElement('textarea');
            replInput.rows = 1;
            replInput.className = 'replInput';
            replInput.addEventListener('keydown', evalExpression, false);
            replView.appendChild(replInput);
        }
    };

    // function resetView() {
    //     chartView.innerHTML = '';
    //     tableView.innerHTML = '';
    // }

    function evalExpression(e) {
        switch (e.code) {
            case 'Backspace':
                if (this.rows > 1) this.rows -= 1;
                break;
            case 'Enter':
                switch (true) {
                    case e.metaKey:
                        e.preventDefault();
                        vscode.postMessage({
                            command: 'evaluate',
                            args: {
                                expression: this.value,
                                pageSize: pageSize,
                            }
                        })
                        break;
                    case e.shiftKey:
                        e.preventDefault();
                        const nodes =  document.querySelectorAll('textarea')
                        const lastNode = nodes[nodes.length - 1];
                        let newInput = false;
                        if (this === lastNode) {
                            newInput = true;
                        }
                        vscode.postMessage({
                            command: 'evaluate',
                            args: {
                                expression: this.value,
                                pageSize: pageSize,
                            },
                            newInput
                        });
                        break;
                    default:
                        this.rows += 1;
                        break;
                }
                break;
        }
    }

    Chart.defaults.color = getVSCodeColor('--vscode-editor-foreground');
    Chart.defaults.borderColor = getVSCodeColor('--vscode-editor-foreground');
    Chart.defaults.backgroundColor = getVSCodeColor('--vscode-editor-foreground');

    function getVSCodeColor(prop) {
        return getComputedStyle(document.body).getPropertyValue(prop);
    }

    function getRandColor() {
        const r = Math.floor(Math.random() * 256)
        const g = Math.floor(Math.random() * 256)
        const b = Math.floor(Math.random() * 256)
        return `rgba(${r}, ${g}, ${b}, 0.5)`
    }

    function createGraph(params, type) {
        // const xAxisKeys = [];
        // const yAxisKeys = [];
        while (chartView.firstChild) {
            chartView.removeChild(chartView.firstChild);
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const uid = new Date().getTime().toString()
        // for (let [key, val] of Object.entries(objects[0])) {
        //     if (key === 'id' || !Number.isInteger(val)) {
        //         xAxisKeys.push(key)
        //     } else {
        //         yAxisKeys.push(key)
        //     }
        // }
        params.data.forEach((obj, idx) => {
            if (obj.id !== undefined) {
                obj[uid] = obj.id.toString();
            } else {
                obj[uid] = idx.toString();
            }
        })

        let datasets = []
        params.yAxisKeys.forEach((key) => {
            const dataset = {
                label: key,
                data: params.data,
                parsing: {
                    yAxisKey: key,
                },
                backgroundColor: getRandColor()
            }
            datasets.push(dataset);
        })
        const cfg = {
            type: type,
            data: {
                datasets: datasets,
            },
            options: {
                parsing: {
                    xAxisKey: uid,
                }
            }
        };
        const chartInstance = new Chart(
            ctx,
            cfg
        );
        const select = document.createElement('select');
        params.xAxisKeys.forEach((key, idx) => {
            const option = document.createElement('option');
            const text = document.createTextNode(key);
            option.appendChild(text);
            option.value = idx.toString();
            select.appendChild(option)
        })
        chartView.appendChild(canvas);
        chartView.appendChild(select);
        select.addEventListener('change', (e) => {
            let key = params.xAxisKeys[parseInt(e.target.value)]
            if (key === 'id') {
                key = uid
            }
            crtXKey = key;
            chartInstance.options.parsing.xAxisKey = key;
            chartInstance.update();
        });
    }

    function createTab() {
        const tab = document.createElement('div');
        tab.className = 'tab';
        const replTab = document.createElement('button');
        replTab.innerText = 'ChartVis'
        replTab.classList.add('tabContent');
        replTab.addEventListener('click', () => {
            document.querySelectorAll('.tabContent').forEach((element) => {
                element.classList.remove('active');
            })
            replTab.classList.add('active')
            viewRenderer.deactivate();
            replView.style.display = 'block';
        })
        tab.appendChild(replTab);
        const recordTab = document.createElement('button');
        recordTab.innerText = 'History';
        recordTab.classList.add('tabContent');
        recordTab.addEventListener('click', () => {
            document.querySelectorAll('.tabContent').forEach((element) => {
                element.classList.remove('active');
            })
            recordTab.classList.add('active')
            replView.style.display = 'none';
            viewRenderer.activate();
        })
        tab.appendChild(recordTab);
        document.body.appendChild(tab);
    }

    createTab();

    const viewRenderer = new HistoryViewRenderer();
    let tableView;
    let chartView;
    let replInput;
    let replView;

    function renderReplView() {
        replView = document.createElement('div');
        replView.className = 'replView';
        replInput = document.createElement('textarea');
        replInput.rows = 1;
        replInput.className = 'replInput';
        replInput.addEventListener('keydown', evalExpression, false);
        replView.appendChild(replInput);
        tableView = document.createElement('div');
        tableView.className = 'tableView';
        replView.appendChild(tableView);
        chartView = document.createElement('div');
        chartView.className = 'chartView';
        replView.style.display = 'none';
        replView.appendChild(chartView);
        document.body.appendChild(replView);
    }

    renderReplView();

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'update':
                eventTriggered = false;
                const recRenderer = new recordRenderer(data.records);
                EventListenerFactory.activate(data.records, data.logIndex, recRenderer, viewRenderer)
                break;
            case 'tableUpdated':
                update(data);
                break;
        };
    });
}());
