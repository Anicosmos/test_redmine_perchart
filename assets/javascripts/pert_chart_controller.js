(function() {
  function makeNodeObj(node) {
    var hasDate = !!(node.start_date || node.due_date);
    var label = '#' + node.issue_id + ' ' + node.subject + '\n' +
      'Start: ' + (node.start_date || '-') + '\n' +
      'End:   ' + (node.due_date   || '-') + '\n' +
      'Dur:   ' + node.duration_days + 'd';

    var color;
    if (node.critical) {
      color = { background: '#f59e0b', border: '#b45309', highlight: { background: '#fbbf24', border: '#92400e' } };
    } else if (!hasDate) {
      color = { background: '#f1f5f9', border: '#94a3b8', highlight: { background: '#e2e8f0', border: '#64748b' } };
    } else {
      color = { background: '#dbeafe', border: '#64748b', highlight: { background: '#bfdbfe', border: '#475569' } };
    }

    return {
      id: node.id,
      label: label,
      _hasDate: hasDate,
      shape: 'box',
      font: { face: 'Segoe UI, Arial, sans-serif', size: 13, color: '#1f2937' },
      margin: 12,
      widthConstraint: { minimum: 180 },
      heightConstraint: { minimum: 70 },
      color: color
    };
  }

  var MIN_CONTAINER_HEIGHT = 540; // px – baseline height when there are few nodes
  var PX_PER_NODE         = 110; // px – estimated vertical space consumed by each node
  var CONTAINER_PADDING   = 80;  // px – extra breathing room above/below nodes
  var MIN_ZOOM_SCALE      = 0.6; // minimum vis-network zoom so nodes stay readable

  function renderPertChart(container, graphData, showNoDates) {
    if (!window.vis) {
      console.warn('redmine_pertchart: vis-network failed to load. Check script inclusion and network access.');
      return 0;
    }
    if (!container || !graphData) return 0;

    var allNodes = graphData.nodes.map(makeNodeObj);
    var noDateNodes = allNodes.filter(function(n) { return !n._hasDate; });
    var filteredNodes = showNoDates ? allNodes : allNodes.filter(function(n) { return n._hasDate; });

    var filteredNodeIdMap = {};
    filteredNodes.forEach(function(n) { filteredNodeIdMap[n.id] = true; });

    var filteredEdges = graphData.edges
      .filter(function(edge) { return filteredNodeIdMap[edge.from] && filteredNodeIdMap[edge.to]; })
      .map(function(edge) {
        return {
          from: edge.from,
          to: edge.to,
          arrows: { to: { enabled: true, scaleFactor: 0.8 } },
          color: { color: '#64748b', highlight: '#0f172a' },
          width: 2,
          smooth: { enabled: true, type: 'cubicBezier' }
        };
      });

    // Size the container to avoid fit() over-shrinking nodes when many tasks are present
    var nodeCount = filteredNodes.length;
    var dynamicHeight = Math.max(MIN_CONTAINER_HEIGHT, nodeCount * PX_PER_NODE + CONTAINER_PADDING);
    container.style.minHeight = dynamicHeight + 'px';

    if (container._visNetwork) {
      container._visNetwork.destroy();
      container._visNetwork = null;
    }

    var data = {
      nodes: new vis.DataSet(filteredNodes),
      edges: new vis.DataSet(filteredEdges)
    };

    var options = {
      layout: {
        hierarchical: {
          enabled: true,
          direction: 'LR',
          levelSeparation: 250,
          nodeSpacing: 130,
          treeSpacing: 200,
          sortMethod: 'directed'
        }
      },
      interaction: {
        dragView: true,
        zoomView: true,
        navigationButtons: true,
        keyboard: true
      },
      physics: false,
      nodes: {
        widthConstraint: { minimum: 180 },
        heightConstraint: { minimum: 70 }
      }
    };

    var network = new vis.Network(container, data, options);
    container._visNetwork = network;

    network.fit({ animation: false });
    // Enforce a minimum zoom so nodes are always readable
    if (network.getScale() < MIN_ZOOM_SCALE) {
      network.moveTo({ scale: MIN_ZOOM_SCALE, animation: false });
    }

    return noDateNodes.length;
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
    if (!graphData) return;

    var toggleEl  = document.getElementById(element.getAttribute('data-pert-chart-toggle-id')   || '');
    var countEl   = document.getElementById(element.getAttribute('data-pert-chart-no-dates-count-id') || '');
    var infoEl    = document.getElementById(element.getAttribute('data-pert-chart-no-dates-info-id')  || '');

    function doRender() {
      var showNoDates = toggleEl ? toggleEl.checked : true;
      var noDateCount = renderPertChart(element, graphData, showNoDates);
      if (countEl) countEl.textContent = noDateCount;
      if (infoEl)  infoEl.style.display = noDateCount > 0 ? '' : 'none';
    }

    doRender();
    if (toggleEl) toggleEl.addEventListener('change', doRender);

    element.dataset.pertChartReady = 'true';
  }

  function initPertChartControllers() {
    var elements = document.querySelectorAll('[data-controller~="pert-chart"]');
    Array.prototype.forEach.call(elements, connectController);
  }

  document.addEventListener('turbo:load', initPertChartControllers);
  document.addEventListener('DOMContentLoaded', initPertChartControllers);
})();
