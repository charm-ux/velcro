// Type-level check that <sl-breadcrumb>'s and <sl-breadcrumb-item>'s `dir` accept any string, as Shoelace 2.20.1 declares
// it (`dir: string`), and that the React wrappers take Shoelace's props.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroBreadcrumb as VelcroBreadcrumbClass } from '../dist/components/breadcrumb/breadcrumb.js';
import type { VelcroBreadcrumbItem as VelcroBreadcrumbItemClass } from '../dist/components/breadcrumb-item/breadcrumb-item.js';
import {
  VelcroBreadcrumb,
  VelcroBreadcrumbItem,
  type VelcroBreadcrumbElement,
  type VelcroBreadcrumbItemElement,
  type VelcroBreadcrumbItemProps,
  type VelcroBreadcrumbProps,
} from '../dist/react/index.js';

declare const breadcrumb: VelcroBreadcrumbClass;
declare const item: VelcroBreadcrumbItemClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
breadcrumb.dir = direction;
item.dir = direction;
breadcrumb.dir = 'rtl';
const read: string = breadcrumb.dir;
void read;

// @ts-expect-error a number is not a direction
breadcrumb.dir = 1;

// The breadcrumb's and the item's own properties are Shoelace's.
breadcrumb.label = 'Breadcrumbs';
const slots: [HTMLSlotElement, HTMLSlotElement, HTMLSlotElement] = [breadcrumb.defaultSlot, breadcrumb.separatorSlot, item.defaultSlot];
void slots;
item.href = '/catalog';
item.href = undefined;
item.target = '_blank';
item.rel = 'noreferrer';
// @ts-expect-error only Shoelace's four targets are accepted
item.target = '_new';
item.hrefChanged();
item.handleSlotChange();

const breadcrumbRef = createRef<VelcroBreadcrumbElement>();
const itemRef = createRef<VelcroBreadcrumbItemElement>();
const breadcrumbProps: VelcroBreadcrumbProps = { label: 'Breadcrumbs' };
const itemProps: VelcroBreadcrumbItemProps = { href: 'https://example.com/home', target: '_self', rel: 'noopener' };
createElement(VelcroBreadcrumb, { ...breadcrumbProps, ref: breadcrumbRef }, createElement(VelcroBreadcrumbItem, { ...itemProps, ref: itemRef }, 'Home'));
