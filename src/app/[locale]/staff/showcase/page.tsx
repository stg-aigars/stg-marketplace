import type { Metadata } from 'next';
import { ShowcaseContent } from './_components/ShowcaseContent';

export const metadata: Metadata = {
  title: 'Component Showcase',
};

export default function ShowcasePage() {
  return <ShowcaseContent />;
}
