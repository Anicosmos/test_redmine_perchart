# frozen_string_literal: true

require 'set'

class PertChartsController < ApplicationController
  before_action :find_project_by_project_id
  before_action :authorize

  helper :projects

  def index
    @issues = @project.issues.visible.to_a
    @graph_data = build_graph_data(@issues)
  end

  private

  def build_graph_data(issues)
    issue_ids = issues.map(&:id)
    relations = IssueRelation
                  .where(issue_from_id: issue_ids, issue_to_id: issue_ids)
                  .where(relation_type: %w[precedes follows])

    adjacency = Hash.new { |h, k| h[k] = [] }
    indegree = Hash.new(0)

    issues.each { |issue| indegree[issue.id] = 0 }

    relations.each do |relation|
      from_id, to_id = relation_edge(relation)
      next unless from_id && to_id

      adjacency[from_id] << to_id
      indegree[to_id] += 1
    end

    sorted_ids = topological_sort(issue_ids, adjacency, indegree)
    issue_by_id = issues.index_by(&:id)
    durations = issues.each_with_object({}) { |issue, map| map[issue.id] = duration_for(issue) }

    earliest_start = Hash.new(0)
    earliest_finish = Hash.new(0)

    sorted_ids.each do |issue_id|
      earliest_finish[issue_id] = earliest_start[issue_id] + durations[issue_id]
      adjacency[issue_id].each do |child_id|
        earliest_start[child_id] = [earliest_start[child_id], earliest_finish[issue_id]].max
      end
    end

    project_duration = sorted_ids.map { |id| earliest_finish[id] }.max || 0
    latest_finish = Hash.new(project_duration)
    latest_start = Hash.new(project_duration)

    sorted_ids.reverse_each do |issue_id|
      if adjacency[issue_id].empty?
        latest_finish[issue_id] = project_duration
      else
        latest_finish[issue_id] = adjacency[issue_id].map { |child_id| latest_start[child_id] }.min
      end
      latest_start[issue_id] = latest_finish[issue_id] - durations[issue_id]
    end

    nodes = sorted_ids.map do |issue_id|
      issue = issue_by_id[issue_id]
      slack = latest_start[issue_id] - earliest_start[issue_id]

      {
        id: issue.id,
        issue_id: issue.id,
        subject: issue.subject,
        start_date: issue.start_date&.to_s,
        due_date: issue.due_date&.to_s,
        duration_days: durations[issue_id],
        critical: slack.zero?
      }
    end

    {
      nodes: nodes,
      edges: adjacency.flat_map { |from_id, targets| targets.map { |to_id| { from: from_id, to: to_id } } },
      project_duration_days: project_duration
    }
  end

  def topological_sort(issue_ids, adjacency, indegree)
    queue = issue_ids.select { |id| indegree[id].zero? }
    sorted = []

    until queue.empty?
      current = queue.shift
      sorted << current

      adjacency[current].each do |neighbor|
        indegree[neighbor] -= 1
        queue << neighbor if indegree[neighbor].zero?
      end
    end

    return sorted if sorted.size == issue_ids.size

    # Fallback for cyclic dependency data: preserve all issues.
    sorted | issue_ids
  end

  def relation_edge(relation)
    case relation.relation_type
    when 'precedes'
      [relation.issue_from_id, relation.issue_to_id]
    when 'follows'
      [relation.issue_to_id, relation.issue_from_id]
    end
  end

  def duration_for(issue)
    if issue.start_date && issue.due_date
      [(issue.due_date - issue.start_date).to_i + 1, 1].max
    elsif issue.estimated_hours.present?
      [(issue.estimated_hours / 8.0).ceil, 1].max
    else
      1
    end
  end
end
