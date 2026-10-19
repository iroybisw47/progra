// Where a user's "just joined Progra" photo lives (app/actions/join-photo.ts
// writes it, lib/db/join-photos.ts signs it). Shared constants, out of the
// "use server" file, which may export only async functions.

export const JOIN_PHOTO_BUCKET = "join-photos";

// One photo per user, replaced by a later post. The first path segment is
// the owner, which the bucket's read policy keys on.
export function joinPhotoPath(userId: string): string {
  return `${userId}/join.jpg`;
}
