import { FeaturePage, featureMetadata } from '@/components/FeaturePage';

export const metadata = featureMetadata('fundamental-analysis');

export default function Page() {
  return <FeaturePage slug="fundamental-analysis" />;
}
