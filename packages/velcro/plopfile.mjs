import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Minimal Velcro component generator, following the plop convention used by @charm-ux/core.
 * It also scaffolds the docs page, one example, a failing product spec skeleton and the sorted catalog entry
 * (packages/docs/catalog.jsonl), which the coverage gate (tests/bootstrap/catalog.test.mjs) requires for every component.
 * It scaffolds the same shape as button/spinner: the class, a `class.ts` that registers no element, with the `Sl*` alias, and a
 * registering `index.ts` that uses the native-registry helper. It does not add the package.json `exports` entries
 * (add `./<name>` and `./<name>/class` by hand) and does not certify that the component works with Velcro's registration.
 */
export default function (plop) {
  plop.setGenerator('Velcro component', {
    description: 'Create a Velcro component that extends the same-named @charm-ux/core component.',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Component name in kebab-case, matching a core component (e.g. button)',
        validate: name =>
          /^[a-z][a-z0-9-]*$/.test(name) && !name.endsWith('-')
            ? true
            : 'Name must be lowercase kebab-case, start with a letter and not end in a dash.',
      },
    ],
    actions: [
      {
        type: 'add',
        skipIfExists: true,
        path: 'src/components/{{kebabCase name}}/{{kebabCase name}}.ts',
        templateFile: 'plop-templates/component.ts.hbs',
      },
      {
        type: 'add',
        skipIfExists: true,
        path: 'src/components/{{kebabCase name}}/{{kebabCase name}}.styles.ts',
        templateFile: 'plop-templates/component.styles.ts.hbs',
      },
      {
        type: 'add',
        skipIfExists: true,
        path: 'src/components/{{kebabCase name}}/class.ts',
        templateFile: 'plop-templates/component.class.ts.hbs',
      },
      {
        type: 'add',
        skipIfExists: true,
        path: 'src/components/{{kebabCase name}}/index.ts',
        templateFile: 'plop-templates/component.index.ts.hbs',
      },
      {
        type: 'add',
        skipIfExists: true,
        path: '../docs/pages/components/{{kebabCase name}}.ts',
        templateFile: 'plop-templates/docs-page.ts.hbs',
      },
      {
        type: 'add',
        skipIfExists: true,
        path: '../docs/examples/{{kebabCase name}}/basic.html',
        templateFile: 'plop-templates/docs-example.html.hbs',
      },
      {
        type: 'add',
        skipIfExists: true,
        path: '../../tests/product/{{kebabCase name}}.spec.mjs',
        templateFile: 'plop-templates/product-spec.mjs.hbs',
      },
      // Idempotent, sorted catalog entry (one JSON object per line).
      answers => {
        const name = plop.getHelper('kebabCase')(answers.name);
        const file = new URL('../docs/catalog.jsonl', import.meta.url);
        const entry = { name, title: plop.getHelper('titleCase')(name), tag: `sl-${name}`, example: '#demo-default' };
        const lines = (existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n').filter(Boolean);
        if (lines.some(line => JSON.parse(line).name === name)) return `exists: catalog entry ${name}`;
        lines.push(JSON.stringify(entry));
        lines.sort((a, b) => (JSON.parse(a).name < JSON.parse(b).name ? -1 : 1));
        writeFileSync(file, `${lines.join('\n')}\n`);
        return `added: catalog entry ${name}`;
      },
      // Idempotent barrel export (plop's own `append` does not see a match on the first line).
      answers => {
        const line = `export * from './components/${plop.getHelper('kebabCase')(answers.name)}/index.js';`;
        const file = new URL('src/index.ts', import.meta.url);
        const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
        if (current.split('\n').includes(line)) return `exists: ${line}`;
        writeFileSync(file, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`);
        return `added: ${line}`;
      },
    ],
  });
}
