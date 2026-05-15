(function() {
  var MIN_CONTAINER_HEIGHT = 540;
  var MIN_VIEWPORT_HEIGHT = 420;
  var PX_PER_NODE = 110;
  var CONTAINER_PADDING = 80;
  var NODE_WIDTH = 260;
  var NODE_HEIGHT = 140;
  var H_GAP = 140;
  var V_GAP = 44;
  var PAD_X = 40;
  var PAD_Y = 40;
  var RESIZE_DEBOUNCE_MS = 120;
  var SUBJECT_MAX_CHARS = 34;
  var EDGE_COLOR = '#64748b';
  var EDGE_CRITICAL_COLOR = '#b45309';
  var MARKER_SEQUENCE = 0;

  function truncateText(value, maxChars) {
    var text = String(value || '');
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1) + '…';
  }

  function displayValue(value) {
    return (value === null || typeof value === 'undefined') ? '-' : value;
  }

  function createArrowMarker(svgNs, markerId, color) {
    var marker = document.createElementNS(svgNs, 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto-start-reverse');

    var arrowPath = document.createElementNS(svgNs, 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', color);
    marker.appendChild(arrowPath);

    return marker;
  }

  function renderPertChart(container, graphData, showNoDates) {
    if (!container || !graphData) return 0;

    var allNodes = graphData.nodes.map(function(node) {
      var hasDate = !!(node.start_date || node.due_date);
      return {
        id: node.id,
        issue_id: node.issue_id,
        subject: node.subject,
        start_date: node.start_date,
        due_date: node.due_date,
        duration_days: node.duration_days,
        earliest_start_days: node.earliest_start_days,
        earliest_finish_days: node.earliest_finish_days,
        latest_start_days: node.latest_start_days,
        latest_finish_days: node.latest_finish_days,
        slack_days: node.slack_days,
        critical: !!node.critical,
        _hasDate: hasDate
      };
    });

    var noDateNodes = allNodes.filter(function(n) { return !n._hasDate; });
    var filteredNodes = showNoDates ? allNodes : allNodes.filter(function(n) { return n._hasDate; });
    var filteredNodeMap = {};
    filteredNodes.forEach(function(n) { filteredNodeMap[n.id] = n; });

    var filteredEdges = graphData.edges.filter(function(edge) {
      return filteredNodeMap[edge.from] && filteredNodeMap[edge.to];
    });

    var nodeCount = filteredNodes.length;
    var dynamicHeight = Math.max(MIN_CONTAINER_HEIGHT, nodeCount * PX_PER_NODE + CONTAINER_PADDING);
    var containerTop = container.getBoundingClientRect().top;
    var viewportBasedHeight = Math.max(MIN_VIEWPORT_HEIGHT, window.innerHeight - containerTop - 24);
    container.style.height = Math.max(dynamicHeight, viewportBasedHeight) + 'px';

    if (filteredNodes.length === 0) {
      container.innerHTML = '<div class="pertchart-empty">No issues available for the selected filter.</div>';
      return noDateNodes.length;
    }

    var adjacency = {};
    var indegree = {};
    filteredNodes.forEach(function(node) {
      adjacency[node.id] = [];
      indegree[node.id] = 0;
    });
    filteredEdges.forEach(function(edge) {
      adjacency[edge.from].push(edge.to);
      indegree[edge.to] += 1;
    });

    var queue = [];
    Object.keys(indegree).forEach(function(nodeId) {
      if (indegree[nodeId] === 0) queue.push(parseInt(nodeId, 10));
    });

    var levels = {};
    filteredNodes.forEach(function(node) { levels[node.id] = 0; });
    var processed = 0;
    while (queue.length > 0) {
      var current = queue.shift();
      processed += 1;
      var currentLevel = levels[current];
      adjacency[current].forEach(function(nextId) {
        levels[nextId] = Math.max(levels[nextId], currentLevel + 1);
        indegree[nextId] -= 1;
        if (indegree[nextId] === 0) queue.push(nextId);
      });
    }

    if (processed !== filteredNodes.length) {
      filteredNodes.forEach(function(node) {
        if (levels[node.id] === null || typeof levels[node.id] === 'undefined') levels[node.id] = 0;
      });
    }

    var nodesByLevel = {};
    var maxLevel = 0;
    filteredNodes.forEach(function(node) {
      var level = levels[node.id] || 0;
      maxLevel = Math.max(maxLevel, level);
      if (!nodesByLevel[level]) nodesByLevel[level] = [];
      nodesByLevel[level].push(node);
    });

    Object.keys(nodesByLevel).forEach(function(level) {
      nodesByLevel[level].sort(function(a, b) { return a.issue_id - b.issue_id; });
    });

    var maxRows = 0;
    Object.keys(nodesByLevel).forEach(function(level) {
      maxRows = Math.max(maxRows, nodesByLevel[level].length);
    });

    var chartWidth = PAD_X * 2 + (maxLevel + 1) * NODE_WIDTH + maxLevel * H_GAP;
    var chartHeight = PAD_Y * 2 + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * V_GAP;

    var positions = {};
    Object.keys(nodesByLevel).forEach(function(levelStr) {
      var level = parseInt(levelStr, 10);
      var list = nodesByLevel[level];
      list.forEach(function(node, index) {
        var x = PAD_X + level * (NODE_WIDTH + H_GAP);
        var y = PAD_Y + index * (NODE_HEIGHT + V_GAP);
        positions[node.id] = { x: x, y: y };
      });
    });

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'pertchart-canvas');
    svg.setAttribute('viewBox', '0 0 ' + chartWidth + ' ' + chartHeight);
    svg.setAttribute('width', chartWidth);
    svg.setAttribute('height', chartHeight);

    var defs = document.createElementNS(SVG_NS, 'defs');
    MARKER_SEQUENCE += 1;
    var markerBase = 'pert-arrow-' + Date.now() + '-' + MARKER_SEQUENCE;
    var defaultMarkerId = markerBase + '-default';
    var criticalMarkerId = markerBase + '-critical';
    defs.appendChild(createArrowMarker(SVG_NS, defaultMarkerId, EDGE_COLOR));
    defs.appendChild(createArrowMarker(SVG_NS, criticalMarkerId, EDGE_CRITICAL_COLOR));
    svg.appendChild(defs);

    filteredEdges.forEach(function(edge) {
      var from = positions[edge.from];
      var to = positions[edge.to];
      if (!from || !to) return;

      var x1 = from.x + NODE_WIDTH;
      var y1 = from.y + (NODE_HEIGHT / 2);
      var x2 = to.x;
      var y2 = to.y + (NODE_HEIGHT / 2);
      var ctrl = Math.max(45, Math.floor((x2 - x1) / 2));

      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + ctrl) + ' ' + y1 + ', ' + (x2 - ctrl) + ' ' + y2 + ', ' + x2 + ' ' + y2);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', edge.critical ? EDGE_CRITICAL_COLOR : EDGE_COLOR);
      path.setAttribute('stroke-width', edge.critical ? '3' : '2');
      if (!edge.critical) path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('marker-end', 'url(#' + (edge.critical ? criticalMarkerId : defaultMarkerId) + ')');
      path.setAttribute('opacity', edge.critical ? '1' : '0.95');
      svg.appendChild(path);
    });

    filteredNodes.forEach(function(node) {
      var pos = positions[node.id];
      if (!pos) return;

      var fill = node.critical ? '#f59e0b' : (node._hasDate ? '#dbeafe' : '#f1f5f9');
      var stroke = node.critical ? '#b45309' : (node._hasDate ? '#64748b' : '#94a3b8');

      var group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('class', 'pertchart-node');

      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', pos.x);
      rect.setAttribute('y', pos.y);
      rect.setAttribute('width', NODE_WIDTH);
      rect.setAttribute('height', NODE_HEIGHT);
      rect.setAttribute('rx', 8);
      rect.setAttribute('ry', 8);
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', node.critical ? '2.5' : '1.5');
      group.appendChild(rect);

      var text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', pos.x + 12);
      text.setAttribute('y', pos.y + 22);
      text.setAttribute('class', 'pertchart-node-text');

      var lines = [
        '#' + node.issue_id + ' ' + truncateText(node.subject, SUBJECT_MAX_CHARS),
        'Duration: ' + displayValue(node.duration_days) + 'd | Slack: ' + displayValue(node.slack_days) + 'd',
        'Earliest (Start/Finish): ' + displayValue(node.earliest_start_days) + '/' + displayValue(node.earliest_finish_days) + 'd',
        'Latest (Start/Finish): ' + displayValue(node.latest_start_days) + '/' + displayValue(node.latest_finish_days) + 'd',
        'Start: ' + (node.start_date || '-') + ' | End: ' + (node.due_date || '-')
      ];

      lines.forEach(function(line, lineIndex) {
        var tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x', pos.x + 12);
        tspan.setAttribute('dy', lineIndex === 0 ? 0 : 20);
        tspan.textContent = line;
        text.appendChild(tspan);
      });

      group.appendChild(text);
      svg.appendChild(group);
    });

    var viewport = document.createElement('div');
    viewport.setAttribute('class', 'pertchart-canvas-viewport');
    viewport.appendChild(svg);

    container.innerHTML = '';
    container.appendChild(viewport);

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

  function debounce(fn, waitMs) {
    var timeoutId;
    return function() {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(fn, waitMs);
    };
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

    var onResize = debounce(doRender, RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', onResize);
    element._pertChartOnResize = onResize;

    element.dataset.pertChartReady = 'true';
  }

  function disconnectController(element) {
    if (element._pertChartOnResize) {
      window.removeEventListener('resize', element._pertChartOnResize);
      element._pertChartOnResize = null;
    }
    element.dataset.pertChartReady = 'false';
  }

  function initPertChartControllers() {
    var elements = document.querySelectorAll('[data-controller~="pert-chart"]');
    Array.prototype.forEach.call(elements, function(el) {
      disconnectController(el);
      connectController(el);
    });
  }

  document.addEventListener('turbo:before-cache', function() {
    var elements = document.querySelectorAll('[data-controller~="pert-chart"]');
    Array.prototype.forEach.call(elements, disconnectController);
  });

  document.addEventListener('turbo:load', initPertChartControllers);
  document.addEventListener('DOMContentLoaded', initPertChartControllers);
})();
