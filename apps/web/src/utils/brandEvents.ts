"use client";

/**
 * Tiny event bus that lets non-adjacent components react to booking-success
 * moments (e.g. triggering a doodle wiggle on the brand logo without threading
 * a callback through every parent).
 */

const BOOKING_SUCCESS_EVENT = "un17:booking-success";

type SuccessListener = () => void;

function getEmitter(): EventTarget | null {
  if (typeof window === "undefined") return null;
  return window;
}

export function emitBookingSuccess(): void {
  const target = getEmitter();
  target?.dispatchEvent(new Event(BOOKING_SUCCESS_EVENT));
}

export function onBookingSuccess(listener: SuccessListener): () => void {
  const target = getEmitter();
  if (!target) return () => {};
  target.addEventListener(BOOKING_SUCCESS_EVENT, listener);
  return () => target.removeEventListener(BOOKING_SUCCESS_EVENT, listener);
}
