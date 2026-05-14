(function() {
  function renderPertChart(container, graphData) {
    if (!window.vis) {
      console.warn('redmine_pertchart: vis-network library is not available.');
      return;
    }
    if (!container || !graphData) return;

    var nodes = graphData.nodes.map(function(node) {
      var label = '#' + node.issue_id + ' ' + node.subject + '\n' +
        'Start: ' + (node.start_date || '-') + '\n' +
        'End: ' + (node.due_date || '-') + '\n' +
        'Duration: ' + node.duration_days + 'd';

      return {
        id: node.id,
        label: label,
        shape: 'box',
        font: { face: 'Segoe UI, Arial, sans-serif', size: 13, color: '#1f2937' },
        margin: 10,
        color: node.critical ? {
          background: '#f59e0b',
          border: '#b45309',
          highlight: { background: '#fbbf24', border: '#92400e' }
        } : {
          background: '#dbeafe',
          border: '#64748b',
          highlight: { background: '#bfdbfe', border: '#475569' }
        }
      };
    });

    var edges = graphData.edges.map(function(edge) {
      return {
        from: edge.from,
        to: edge.to,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        color: { color: '#64748b', highlight: '#0f172a' },
        width: 2,
        smooth: { enabled: true, type: 'cubicBezier' }
      };
    });

    var data = {
      nodes: new vis.DataSet(nodes),
      edges: new vis.DataSet(edges)
    };

    var options = {
      layout: { hierarchical: { direction: 'LR', levelSeparation: 170, nodeSpacing: 150 } },
      interaction: {
        dragView: true,
        zoomView: true,
        navigationButtons: true,
        keyboard: true
      },
      physics: false
    };

    var network = new vis.Network(container, data, options);
    network.fit();
  }

  function parseGraphValue(element) {
    var payload = element.getAttribute('data-pert-chart-graph-value');
    if (!payload) return null;

    try {
      return JSON.parse(payload);
    } catch (_error) {
      return null;
    }
  }

  function connectController(element) {
    if (element.dataset.pertChartReady === 'true') return;

    var graphData = parseGraphValue(element);
    renderPertChart(element, graphData);
    element.dataset.pertChartReady = 'true';
  }

  function initPertChartControllers() {
    var elements = document.querySelectorAll('[data-controller~="pert-chart"]');
    Array.prototype.forEach.call(elements, connectController);
  }

  document.addEventListener('turbo:load', initPertChartControllers);
  document.addEventListener('DOMContentLoaded', initPertChartControllers);
})();
