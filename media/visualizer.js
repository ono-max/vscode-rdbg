// @ts-check

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const container = document.querySelector('#container');

    let visualizedObject;
    let yAxisKeys = [];

    const visualization = document.querySelector('#visualization');

    const tableView = document.querySelector('.tableView')

    let uid;

    function update(objects) {
        if (visualization instanceof HTMLSelectElement) {
            visualization.disabled = false;
        }
        new gridjs.Grid({
            pagination: {
                limit: 50
              },
              sort: true,
              search: true,
            data: objects,
          }).render(tableView);
        container?.appendChild(tableView);
        uid = new Date().getTime().toString()
        objects.forEach((obj, idx) => {
            console.log(obj)
            if (obj.get('id') !== undefined) {
                obj.set(uid, obj.get('id'))
            } else {
                obj.set(uid, idx.toString())
            }
        })
        visualizedObject = objects;
    };

    let myChart;

    document.querySelector('#visualization').addEventListener('change', (e)=> {
        if (e.target.value === 'bar-chart') {
          document.querySelector(".tableView").style.display = 'none';
          if (myChart) {
            document.getElementById('myChart').style.display = 'block';
            return;
          }
          let datasets = []
          yAxisKeys.forEach((key) => {
            const dataset = {
                label: key,
                data: visualizedObject,
                parsing: {
                    yAxisKeys: key,
                }
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
          myChart = new Chart(
          document.getElementById('myChart'),
          cfg
        );
        } else {
          document.querySelector(".tableView").style.display = 'block'
          document.getElementById('myChart').style.display = 'none';
        }
      })

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'update':
                update(data.object);
                break;
        };
    });
}());
