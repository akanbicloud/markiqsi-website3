import { FeaturePage, featureMetadata } from '@/components/FeaturePage';

export const metadata = featureMetadata('academy');

export default function Page() {
  return <FeaturePage slug="academy" />;
}
