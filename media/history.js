// @ts-check

const space = "\xA0"
const rbenvRegexp = /\.rbenv\/versions\/\d\.\d\.\d\/lib\//
const gemRegexp = /ruby\/gems\/\d.\d.\d\/gems\//

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

export class HistoryInspector {
    #recordBtn;
    #goBackToBtn;
    #goToBtn;
    #input;
    #historyView
    #vscode
    #pageSize = 30;
    /**
     * @param {import("vscode").Webview} vscode
     */
    constructor(vscode) {
        this.#vscode = vscode;
        this.#recordBtn = this._renderRecordButton();
        this.#goBackToBtn = this._renderStepBackButton();
        this.#goToBtn = this._renderStepInButton();
        this.#input = this._renderFilterInput();
        this._initializeView();
    }

    activate() {
        this.#historyView.style.display = 'block';
    }

    deactivate() {
        this.#historyView.style.display = 'none';
    }

    _renderRecordButton() {
        const recordBtn = document.createElement('li');
        recordBtn.innerHTML = SVG_ICONS.startRecord;
        recordBtn.className = 'recordButton';
        const self = this;
        recordBtn.addEventListener('click', function () {
            if (this.querySelector('.start') !== null) {
                this.innerHTML = SVG_ICONS.stopRecord;
                self.#vscode.postMessage({
                    command: 'startRecord'
                })
            } else {
                this.innerHTML = SVG_ICONS.startRecord;
                self.#vscode.postMessage({
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
        goToBtn.classList.add('disabled');
        const self = this;
        goToBtn.addEventListener('click', function () {
            if (this.classList.contains('disabled')) {
                return
            }
            self.#vscode.postMessage({
                command: 'goTo',
                times: 1
            })
        })
        return goToBtn;
    }

    _renderStepBackButton() {
        const goBackToBtn = document.createElement('li');
        goBackToBtn.innerHTML = SVG_ICONS.goBackTo;
        goBackToBtn.className = 'goBackToButton';
        goBackToBtn.classList.add('disabled');
        const self = this;
        goBackToBtn.addEventListener('click', function () {
            if (this.classList.contains('disabled')) {
                return
            }
            self.#vscode.postMessage({
                command: 'goBackTo',
                times: 1
            })
        })
        return goBackToBtn;
    }

    _renderFilterInput() {
        const input = document.createElement('input');
        input.className = 'filterInput';
        const self = this;
        input.addEventListener('input', (e) => {
            if (!(e.target instanceof HTMLInputElement)) return;
            self.#vscode.postMessage({
                command: 'searchExecLogs',
                keyword: e.target.value
            })
        })
        return input;
    }

    _initializeView() {
        this.#historyView = document.createElement('div');
        this.#historyView.className = 'historyView';
        const ul = document.createElement('ul');
        ul.classList.add('debugButtons');
        ul.appendChild(this.#recordBtn);
        ul.appendChild(this.#goBackToBtn);
        ul.appendChild(this.#goToBtn);
        const header = document.createElement('div');
        header.className = 'header'
        header.appendChild(this.#input);
        header.appendChild(ul);
        this.#historyView.appendChild(header);
        const frames = document.createElement('div');
        frames.className = 'frames';
        this.#historyView.appendChild(frames);
        document.body.appendChild(this.#historyView);
    }

    _enableDebugCmdBtns() {
        this.#recordBtn.classList.remove('disabled');
        this.#goBackToBtn.classList.remove('disabled');
        this.#goToBtn.classList.remove('disabled');
    }

    printExecLogs(execLogs, currentLogIndex, totalLen) {
        const frameContainer = document.querySelector('.frames');
        _resetView();
        this._enableDebugCmdBtns()

        const vscode = this.#vscode;
        const pageSize = this.#pageSize;

        const minDepth = _findMinDepth(execLogs);
        execLogs.forEach((frame, index) => {
            const div = document.createElement('div');
            div.classList.add('frame');
            div.setAttribute('data-index', index);
            const collapsible = document.createElement('div');
            collapsible.classList.add('collapsible');
            collapsible.innerHTML = SVG_ICONS.collapsed;
            div.appendChild(collapsible);
            const depth = frame.depth - minDepth
            div.style.paddingLeft = `${depth}em`;
            div.setAttribute('data-depth', depth.toString())
            const name = document.createTextNode(frame.name);
            div.appendChild(name);
            const args = _getArgs(frame.args);
            div.appendChild(args);
            _addShowLocationsListener(div);
            frameContainer.appendChild(div);
            frame.locations.forEach((loc) => {
                if (loc.index === currentLogIndex) {
                    div.click()
                }
            })
        })

        const pagination = _paginate(totalLen);
        frameContainer?.appendChild(pagination);

        function _addShowLocationsListener(element) {
            element.addEventListener('click', function () {
                const result = this.classList.toggle('locationShowed');
                const collapsible = this.querySelector('.collapsible');
                if (!result) {
                    collapsible.innerHTML = SVG_ICONS.collapsed;
                    this.nextElementSibling.remove();
                    return;
                }
                collapsible.innerHTML = SVG_ICONS.expanded
                const frameIdx = this.dataset.index;
                const frame = execLogs[frameIdx];
                const parent = document.createElement('div')
                const depth = parseInt(this.dataset.depth) + 2
                frame.locations.forEach((loc) => {
                    const div = document.createElement('div');
                    div.classList.add('location');
                    div.setAttribute('data-index', loc.index);
                    let name = loc.name.replace(rbenvRegexp, '');
                    name = name.replace(gemRegexp, '');
                    div.style.paddingLeft = `${depth}em`;
                    _createTableData(name, div);
                    _addStepListener(div)
                    if (loc.index === currentLogIndex) {
                        div.classList.add('stopped');
                    }
                    parent.appendChild(div);
                })
                this.insertAdjacentElement('afterend', parent)
            })
        }

        function _findMinDepth(logs) {
            let min = logs[0].depth
            for (let i = 1; i < logs.length; i++) {
                const depth = logs[i].depth
                if (min > depth) {
                    min = depth;
                }
            }
            return min
        }

        function _getArgs(args) {
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

        function _resetView() {
            frameContainer.innerHTML = '';
        }

        function _createTableData(data, parent) {
            const text = document.createTextNode(data);
            parent.appendChild(text);
        }

        function _addStepListener(element) {
            element.addEventListener('click', function () {
                if (this.classList.contains('stopped')) {
                    return;
                }

                let times = currentLogIndex - parseInt(this.dataset.index);
                console.log(times, currentLogIndex, this.dataset.index)
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

        function _paginate(len) {
            const totalPage = Math.ceil(len / pageSize);
            const pagination = document.createElement('div');
            pagination.className = 'pagination';
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            pagination.appendChild(prevBtn);
            for (let i = 1; i <= totalPage; i++) {
                const btn = document.createElement('button');
                btn.textContent = i.toString();
                btn.addEventListener('click', () => {
                    const offset = (i - 1) * pageSize;
                    vscode.postMessage({
                        command: 'getExecLogs',
                        offset,
                        pageSize: pageSize
                    })
                })
                pagination.appendChild(btn);
            }
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            pagination.appendChild(nextBtn);
            return pagination
        }
    }

}
