# Editorial Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Independent writing batches use dispatching-parallel-agents; the parent owns shared files and deployment.

**Goal:** Revise all 149 existing stories and enforce a more varied, detailed illustrated publication standard from October 15.

**Architecture:** Writers produce isolated JSON revisions in ignored backups. The parent reviews and renders them into existing pages, preserves identities and sources, adds actual product reference images, updates shared publication rules and verifies the complete release.

**Tech Stack:** Static HTML/CSS, Node.js, Pillow/WebP, built-in imagegen for future publications, agent-browser, Git/Vercel.

**Spec:** docs/superpowers/specs/2026-10-14-editorial-refresh-design.md

## Global Constraints

149 URLs and original dates preserved; no invented facts or customer testimony; two or more images in existing articles; new daily articles 2,400+ Korean characters and three images with at least two newly generated; LookBook two photos with different photographic approaches; preserve all unrelated work and automation fields.

## Review Focus

- First two brand posts contain unsupported historical claims: rewrite from verified public brand facts.
- Source product cannot be found: mark unresolved and recover exact mapping before publication.
- Fact expanded beyond original evidence: verify official source or simplify it.
- Repeated boilerplate across batches: inspect duplicate paragraphs and fix before release.
- Long paragraphs/images/tables overflow on mobile: verify responsive browser rendering.

## Tasks

- [x] Back up and inventory every story and exact product reference or explicitly selected real example.
- [x] Rewrite six independent batches of 25/24 articles; read humanizer and supply concrete examples and distinct arguments.
- [x] Download and inspect genuine references; optimize and annotate provenance.
- [x] Integrate all article JSON, add inline figures, keep canonical URLs/dates and update metadata/feed.
- [x] Change daily publication docs, verification requirements and existing automation prompt for October 15.
- [x] Verify all articles, review individual exceptions and run relevant tests and desktop/mobile browser checks.
- [ ] Commit only this task's files, push, verify exact production deployment and document completion.
