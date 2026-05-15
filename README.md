# redmine_pertchart

Professional PERT Chart plugin scaffold for **Redmine 6.x (Rails 7.x)**.

It visualizes project issue dependencies (`precedes` / `follows`) as a network diagram, and highlights critical-path tasks.

## Current verification status (this repository)

The plugin source passes local sanity checks:

- Ruby syntax:
  - `/home/runner/work/redmine_pertchart/redmine_pertchart/init.rb`
  - `/home/runner/work/redmine_pertchart/redmine_pertchart/config/routes.rb`
  - `/home/runner/work/redmine_pertchart/redmine_pertchart/app/controllers/pert_charts_controller.rb`
- JavaScript syntax:
  - `/home/runner/work/redmine_pertchart/redmine_pertchart/assets/javascripts/pert_chart_controller.js`
- Locale YAML parse:
  - `/home/runner/work/redmine_pertchart/redmine_pertchart/config/locales/en.yml`

> Note: Full runtime verification requires a running Redmine instance with project issues and relations.

---

## Installation (standard Redmine)

### 1) Copy plugin into Redmine

From your Redmine server:

```bash
cd /path/to/redmine/plugins
git clone https://github.com/Anicosmos/redmine_pertchart.git redmine_pertchart
```

Or copy this plugin folder manually into:

```text
/path/to/redmine/plugins/redmine_pertchart
```

### 2) Install/update gems (if required by your Redmine deployment)

```bash
cd /path/to/redmine
bundle install
```

### 3) Run plugin migrations

```bash
cd /path/to/redmine
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
```

### 4) Restart Redmine

- Passenger/Apache/Nginx: restart app/service.
- Puma/systemd: restart Redmine service.

### 5) Enable module/permissions in project

1. Open target project in Redmine.
2. Go to **Settings → Modules** and enable **PERT Chart** (module key: `pertchart`).
3. Go to **Settings → Members/Roles** and grant permission **View PERT chart**.

### 6) Open the chart

- From project menu, open **PERT Chart**, or
- visit:

```text
/projects/<project_identifier>/pert_chart
```

---

## Installation (Bitnami Redmine in Docker)

Bitnami commonly persists Redmine data under `/bitnami/redmine` and runs application code under `/opt/bitnami/redmine`.

### Option A: docker-compose volume mount (recommended)

In your `docker-compose.yml`, mount plugin into the Redmine plugins directory:

```yaml
services:
  redmine:
    image: bitnami/redmine:latest
    volumes:
      - redmine_data:/bitnami/redmine
      - ./redmine_pertchart:/bitnami/redmine/plugins/redmine_pertchart
```

Then recreate/restart container.

### Option B: copy plugin into running container

```bash
docker cp ./redmine_pertchart <container_name>:/bitnami/redmine/plugins/redmine_pertchart
```

### Run migration inside container

```bash
docker exec -it <container_name> bash
cd /opt/bitnami/redmine
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
exit
```

### Restart container

```bash
docker restart <container_name>
```

### Enable in Redmine UI

Inside Redmine project:

1. **Settings → Modules**: enable **PERT Chart**.
2. **Roles and permissions**: enable **View PERT chart** for relevant roles.

### Open chart URL

```text
https://<your-redmine-host>/projects/<project_identifier>/pert_chart
```

---

## Runtime verification checklist

After installation, verify:

1. Project menu shows **PERT Chart**.
2. Page loads without Rails errors.
3. Issues appear as nodes with:
   - Issue ID
   - Subject
   - Start/End dates
   - Duration
4. `precedes`/`follows` relations render as directed arrows.
5. At least one dependency chain is highlighted as critical-path tasks.
6. Zoom/pan/navigation controls work.

---

## Troubleshooting

### PERT page is missing from project menu

- Confirm module enabled in **Project → Settings → Modules**.
- Confirm role has **View PERT chart** permission.
- Restart Redmine after plugin install.

### Chart container appears but graph is empty

- Ensure project has issues visible to current user.
- Ensure issue relations exist (`precedes` / `follows`).
- Check browser console for JavaScript errors from `pert_chart_controller.js`.

### Migration errors

- Run migration from Redmine root.
- Use the same Ruby/Bundler environment as Redmine app.
- In Docker, run migration inside the Redmine container.

### If you need to remove plugin migrations

```bash
cd /path/to/redmine
bundle exec rake redmine:plugins:migrate NAME=redmine_pertchart VERSION=0 RAILS_ENV=production
```
