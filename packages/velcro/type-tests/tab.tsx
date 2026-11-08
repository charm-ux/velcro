// Type-level checks for <sl-tab> and <sl-tab-group>: `dir` accepts any string, as Shoelace 2.20.1 declares it (`dir: string`),
// and the Shoelace members and the React event callbacks are typed as Shoelace types them. Compiled (never run) by
// `tsc -p tsconfig.react.json` as the last step of the library build.
import type { VelcroTab } from '../dist/components/tab/tab.js';
import type { VelcroTabGroup } from '../dist/components/tab-group/tab-group.js';
import type { VelcroTabGroupProps } from '../dist/react/index.js';

declare const tab: VelcroTab;
declare const group: VelcroTabGroup;
declare const direction: string;

tab.dir = direction;
group.dir = direction;
const read: string = tab.dir + group.dir;
void read;

tab.panel = 'general';
tab.active = true;
tab.closable = true;
tab.disabled = false;
tab.tabIndex = -1;

group.placement = 'start';
group.activation = 'manual';
group.noScrollControls = true;
group.fixedScrollControls = false;
group.show('general');
const nav: HTMLElement = group.nav;
void nav;

// The generated React callbacks get Shoelace's event types: `CustomEvent<{ name: string }>`, a primitive string.
const reactProps: VelcroTabGroupProps = {
  onSlTabShow: event => {
    const name: string = event.detail.name;
    void name;
  },
  onSlTabHide: event => {
    const name: string = event.detail.name;
    void name;
  },
};
void reactProps;

// @ts-expect-error placement is one of top, bottom, start and end
group.placement = 'left';
// @ts-expect-error activation is auto or manual
group.activation = 'click';
// @ts-expect-error a number is not a direction
tab.dir = 1;
