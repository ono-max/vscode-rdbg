// @ts-check

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const container = document.querySelector('#container');
    let crtXKey = 'id';

    const visualization = document.querySelector('#visualization');

    const tableView = document.querySelector('.tableView')

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
        tableView?.appendChild(table);
    }

    const pageSize = 30;

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
        tableView?.appendChild(ul);
    }

    async function getNewPage() {
        const pageNum = this.dataset.pageNum;
        const offset = (pageNum - 1) * pageSize;
        vscode.postMessage({
            command: 'updateTable',
            args: {
                offset,
                pageSize,
            }
        })
    }

    function update(data) {
        if (visualization instanceof HTMLSelectElement) {
            if (visualization.disabled) {
                visualization.disabled = false;                
            }
        }
        resetView();
        const input = document.createElement('input');
        input.className = 'replInput';
        input.type = 'text';
        input.addEventListener('keydown', evalExpression, false)
        tableView?.appendChild(input);
        createTable(data.objects);
        pagination(data.totalLength);
        createGraph(data.objects);
    };

    function resetView() {
        myChart.innerHTML = '';
        tableView.innerHTML = '';
    }

    function evalExpression(e) {
        if (e.code == 'Enter') {
            vscode.postMessage({
                command: 'evaluate',
                args: {
                    expression: this.value,
                    pageSize: pageSize
                }
            })
        }
    }

    Chart.defaults.color = getVSCodeColor('--vscode-editor-foreground');
    Chart.defaults.borderColor =  getVSCodeColor('--vscode-editor-foreground');
    Chart.defaults.backgroundColor = getVSCodeColor('--vscode-editor-foreground');

    function getVSCodeColor(prop) {
        return getComputedStyle(container).getPropertyValue(prop);
    }

    function getRandColor() {
        const r = Math.floor(Math.random() * 256)
        const g = Math.floor(Math.random() * 256)
        const b = Math.floor(Math.random() * 256)
        return `rgba(${r}, ${g}, ${b}, 0.5)`
    }

    function createGraph(objects) {
        const xAxisKeys = [];
        const yAxisKeys = [];
        while (myChart?.firstChild) {
            myChart.removeChild(myChart.firstChild);
        }
        myChart.style.display = 'none';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const uid = new Date().getTime().toString()
        for (let [key, val] of Object.entries(objects[0])) {
            if (key === 'id' || !Number.isInteger(val)) {
                xAxisKeys.push(key)
            } else {
                yAxisKeys.push(key)
            }
        }
        objects.forEach((obj, idx) => {
            if (obj.id !== undefined) {
                obj[uid] = obj.id.toString();
            } else {
                obj[uid] = idx.toString();
            }
        })

        let datasets = []
        yAxisKeys.forEach((key) => {
            const dataset = {
                label: key,
                data: objects,
                parsing: {
                    yAxisKey: key,
                },
                backgroundColor: getRandColor()
            }
            datasets.push(dataset);
        })
        const cfg = {
            type: 'bar',
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
        xAxisKeys.forEach((key, idx) => {
            const option = document.createElement('option');
            const text = document.createTextNode(key);
            option.appendChild(text);
            option.value = idx.toString();
            select.appendChild(option)
        })
        myChart?.appendChild(canvas);
        myChart?.appendChild(select);
        select.addEventListener('change', () => {
            let key = xAxisKeys[parseInt(this.value)]
            if (key === 'id') {
                key = uid
            }
            crtXKey = key;
            chartInstance.options.parsing.xAxisKey = key;
            chartInstance.update();
        });
    }

    const myChart = document.querySelector('.chartView');

    visualization.addEventListener('change', (e)=> {
        if (e.target.value === 'bar-chart') {
            tableView.style.display = 'none';
            myChart.style.display = 'block';
        } else {
            tableView.style.display = 'block'
            myChart.style.display = 'none';
        }
    })

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'tableUpdated':
                update(data);
                break;
        };
    });
}());
