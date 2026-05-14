# frozen_string_literal: true

get 'projects/:project_id/pert_chart', to: 'pert_charts#index', as: :project_pert_chart
