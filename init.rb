# frozen_string_literal: true

require 'redmine'

Redmine::Plugin.register :redmine_pertchart do
  name 'Redmine PERT Chart'
  author 'Anicosmos'
  description 'Professional PERT chart visualization with critical path highlighting for project issues.'
  version '0.1.0'
  url 'https://github.com/Anicosmos/redmine_pertchart'
  author_url 'https://github.com/Anicosmos'

  project_module :pertchart do
    permission :view_pertchart, pert_charts: [:index]
  end

  menu :project_menu,
       :pertchart,
       { controller: 'pert_charts', action: 'index' },
       caption: :label_pertchart,
       param: :project_id
end
