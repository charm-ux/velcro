import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Minimal Velcro component generator, following the plop convention used by @charm-ux/core. */
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
        path: 'src/components/{{kebabCase name}}/index.ts',
        templateFile: 'plop-templates/component.index.ts.hbs',
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
