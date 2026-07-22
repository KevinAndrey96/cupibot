export function descendingPhotoBudgets(imageCount: number): number[] {
  if (imageCount === 0) {
    return [0];
  }

  const budgets: number[] = [];

  for (let count = imageCount; count >= 1; count--) {
    budgets.push(count);
  }

  return budgets;
}

export function selectVisionPhotos(photos: string[], count: number): string[] {
  return photos.slice(0, count);
}
