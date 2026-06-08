"use client";
import { useEffect } from "react";

/** Reveal-on-scroll for the landing page: fades/raises any `.ec-reveal` element into view once. */
export default function RevealScript() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".ec-reveal"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return null;
}
