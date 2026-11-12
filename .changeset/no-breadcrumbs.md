---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": major
"@oppenheimer/translations": minor
"@oppenheimer/web-showcase": patch
---

No breadcrumbs anywhere in the console.

- `@oppenheimer/web`: a project's page opens with the Back pill to Projects
  instead of a breadcrumb; an automation, Add a host and a host's Desktop
  drop the breadcrumb under their Back pill.
- `@oppenheimer/design-system-web`: `PageHeaderCrumbs` and `PageHeaderHere`
  are removed.
- `@oppenheimer/web-showcase`: the PageHeader demos lose their crumbs.
- `@oppenheimer/translations`: `common.breadcrumb`,
  `automations.detail.crumb` and `hosts.add.crumbHosts` are removed.
