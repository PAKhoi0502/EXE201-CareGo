import assert from "node:assert/strict";
import test from "node:test";
import { blogSeedPosts } from "./blog-seed-data.js";
import {
  BLOG_ACTIVITY_WINDOWS,
  blogInteractionProfiles,
  getBlogPublishedDateKey,
  getSeedActivityDate,
  getSeedCommentContent,
} from "./blog-interaction-seed.js";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const toVietnamDateKey = (date) =>
  new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);

const getWindowDays = (window) => {
  const start = new Date(`${window.startDate}T00:00:00.000Z`);
  const end = new Date(`${window.endDate}T00:00:00.000Z`);
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
};

const buildActivitySummary = (type, getCount) => {
  const counts = new Map(BLOG_ACTIVITY_WINDOWS.map((window) => [window.key, 0]));
  let earliestDate = "9999-12-31";
  let latestDate = "0000-01-01";

  blogSeedPosts.forEach((post, postIndex) => {
    const publishedDateKey = getBlogPublishedDateKey(post.date);
    for (let eventIndex = 0; eventIndex < getCount(post); eventIndex += 1) {
      const activityDate = getSeedActivityDate({
        eventIndex,
        postIndex,
        publishedDate: post.date,
        type,
      });
      const dateKey = toVietnamDateKey(activityDate);
      assert.ok(dateKey >= publishedDateKey, `${post.slug} có tương tác trước ngày xuất bản`);
      earliestDate = dateKey < earliestDate ? dateKey : earliestDate;
      latestDate = dateKey > latestDate ? dateKey : latestDate;
      const window = BLOG_ACTIVITY_WINDOWS.find(
        (item) => dateKey >= item.startDate && dateKey <= item.endDate,
      );
      assert.ok(window, `${dateKey} nằm ngoài khoảng tương tác đã cấu hình`);
      counts.set(window.key, counts.get(window.key) + 1);
    }
  });

  return {
    earliestDate,
    latestDate,
    rates: BLOG_ACTIVITY_WINDOWS.map((window) =>
      Number((counts.get(window.key) / getWindowDays(window)).toFixed(4)),
    ),
  };
};

test("blog seed has varied but correlated view and comment volumes", () => {
  const rows = blogSeedPosts.map((post) => ({
    slug: post.slug,
    views: post.viewCount,
    comments: blogInteractionProfiles[post.slug]?.commentCount,
  }));

  assert.equal(rows.some((row) => row.comments === undefined), false);
  assert.ok(Math.max(...rows.map((row) => row.views)) >= 300);
  assert.ok(Math.max(...rows.map((row) => row.views)) < 400);
  assert.ok(Math.max(...rows.map((row) => row.comments)) >= 10);
  assert.ok(Math.max(...rows.map((row) => row.comments)) < 20);
  assert.ok(new Set(rows.map((row) => row.views)).size >= 8);
  assert.ok(new Set(rows.map((row) => row.comments)).size >= 8);

  const byViews = [...rows].sort((left, right) => right.views - left.views).map((row) => row.slug);
  const byComments = [...rows].sort((left, right) => right.comments - left.comments).map((row) => row.slug);
  assert.deepEqual(byComments, byViews);
});

test("seeded blog activity is busiest through June 28 and then declines into early August", () => {
  const summary = buildActivitySummary("view", (post) => post.viewCount);

  assert.equal(summary.earliestDate, "2026-06-01");
  assert.ok(summary.latestDate <= "2026-08-09");
  summary.rates.slice(1).forEach((rate, index) => {
    assert.ok(rate < summary.rates[index], `${rate} phải thấp hơn ${summary.rates[index]}`);
  });
});

test("seeded comments follow the configured count and remain realistic", () => {
  const summary = buildActivitySummary(
    "comment",
    (post) => blogInteractionProfiles[post.slug].commentCount,
  );
  const totalComments = Object.values(blogInteractionProfiles)
    .reduce((sum, profile) => sum + profile.commentCount, 0);

  assert.equal(totalComments, 94);
  assert.ok(summary.earliestDate >= "2026-06-01");
  assert.ok(summary.earliestDate <= "2026-06-03");
  assert.ok(summary.latestDate <= "2026-08-09");
  summary.rates.slice(1).forEach((rate, index) => {
    assert.ok(rate < summary.rates[index], `${rate} phải thấp hơn ${summary.rates[index]}`);
  });
  blogSeedPosts.forEach((post) => {
    const profile = blogInteractionProfiles[post.slug];
    const contents = Array.from(
      { length: profile.commentCount },
      (_, commentIndex) => getSeedCommentContent(post.slug, commentIndex),
    );
    assert.equal(new Set(contents).size, profile.commentCount);
    assert.equal(contents.every((content) => content.length >= 40), true);
  });
});
