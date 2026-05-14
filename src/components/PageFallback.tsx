import React from 'react';
import { LoadingOverlay } from './LoadingOverlay';

interface PageFallbackProps {
  open?: boolean;
  title?: string;
  description?: string;
}

export const PageFallback: React.FC<PageFallbackProps> = ({
  open = true,
  title = '界面加载中',
  description = '正在打开目标页面，资源马上就绪...'
}) => (
  <LoadingOverlay
    open={open}
    title={title}
    description={description}
  />
);
