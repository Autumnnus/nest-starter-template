export type MediaKind = 'image' | 'video' | 'audio' | 'document';

export type MediaPurpose =
  | 'avatar'
  | 'game'
  | 'cover'
  | 'post'
  | 'banner'
  | 'attachment'
  | (string & {});

export type ImageVariantName = 'thumb' | 'mobile' | 'web' | 'retina';
