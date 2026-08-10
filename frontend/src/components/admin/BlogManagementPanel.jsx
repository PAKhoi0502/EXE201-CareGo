import { useMemo, useState } from "react";
import { api } from "../../api/client.js";
import { Button, Card, Input, Select, Textarea } from "../Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const emptyForm = {
  title: "",
  slug: "",
  category: "",
  readTime: "",
  date: "",
  excerpt: "",
  highlight: "",
  imageUrl: "",
  content: [{ heading: "", body: "" }],
  isFeatured: false,
  displayOrder: 0,
};

const getFormFromBlog = (blog) => ({
  title: blog?.title || "",
  slug: blog?.slug || "",
  category: blog?.category || "",
  readTime: blog?.readTime || "",
  date: blog?.date || "",
  excerpt: blog?.excerpt || "",
  highlight: blog?.highlight || "",
  imageUrl: blog?.imageUrl || "",
  content: blog?.content?.length
    ? blog.content.map((section) => ({ heading: section.heading || "", body: section.body || "" }))
    : [{ heading: "", body: "" }],
  isFeatured: Boolean(blog?.isFeatured),
  displayOrder: blog?.displayOrder || 0,
});

const buildPayload = (form) => ({
  title: form.title,
  slug: form.slug,
  category: form.category,
  readTime: form.readTime,
  date: form.date,
  excerpt: form.excerpt,
  highlight: form.highlight,
  imageUrl: form.imageUrl,
  content: form.content.map((section) => ({ heading: section.heading, body: section.body })),
  isFeatured: form.isFeatured,
  displayOrder: Number(form.displayOrder || 0),
});

const statusLabels = {
  draft: "Bản nháp",
  published: "Đã đăng",
  deleted: "Đã xóa",
};

const getBlogStatus = (blog) => {
  if (blog?.isDeleted || blog?.status === "deleted") return "deleted";
  return blog?.status || (blog?.isPublished ? "published" : "draft");
};

const BlogStatusBadge = ({ status }) => {
  const className = status === "published"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "deleted"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {statusLabels[status] || "Không rõ"}
    </span>
  );
};

const BlogFormModal = ({ title, form, setForm, error, saving, onClose, onSubmit, submitLabel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-400">Mỗi mục có tiêu đề và nội dung riêng; xuống dòng và bullet sẽ được giữ nguyên.</p>
        </div>
        <button
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
          onClick={onClose}
          type="button"
        >
          Đóng
        </button>
      </div>

      <form className="grid gap-4 p-5" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Input required label="Tiêu đề" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
          <Input required label="Danh mục" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <Input label="Thời gian đọc" value={form.readTime} onChange={(event) => setForm({ ...form, readTime: event.target.value })} />
          <Input label="Ngày hiển thị" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          <Input
            label="Thứ tự hiển thị"
            type="number"
            value={form.displayOrder}
            onChange={(event) => setForm({ ...form, displayOrder: event.target.value })}
          />
        </div>

        <Textarea required label="Tóm tắt" value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} />
        <Textarea label="Điểm chính" value={form.highlight} onChange={(event) => setForm({ ...form, highlight: event.target.value })} />
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-800">Nội dung bài viết</p>
              <p className="mt-1 text-xs text-slate-500">Có thể nhập nhiều đoạn hoặc danh sách trong từng mục.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 px-3 text-xs"
              onClick={() => setForm({ ...form, content: [...form.content, { heading: "", body: "" }] })}
            >
              Thêm mục
            </Button>
          </div>
          {form.content.map((section, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-teal-700">Mục {index + 1}</p>
                {form.content.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-black text-rose-600 hover:underline"
                    onClick={() => setForm({ ...form, content: form.content.filter((_, itemIndex) => itemIndex !== index) })}
                  >
                    Xóa mục
                  </button>
                ) : null}
              </div>
              <Input
                required
                label="Tiêu đề mục"
                value={section.heading}
                onChange={(event) => setForm({
                  ...form,
                  content: form.content.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, heading: event.target.value } : item),
                })}
              />
              <Textarea
                required
                label="Nội dung mục"
                className="min-h-36 whitespace-pre-wrap"
                value={section.body}
                onChange={(event) => setForm({
                  ...form,
                  content: form.content.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, body: event.target.value } : item),
                })}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Ảnh cover URL" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          <label className="flex min-h-10 items-center gap-3 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
            />
            Hiển thị ở trang chủ
          </label>
          <p className="text-xs font-semibold text-slate-500 md:col-span-2">
            Thay đổi nội dung không tự đăng bài. Hãy dùng nút Đăng bài hoặc Gỡ đăng ở danh sách sau khi lưu.
          </p>
        </div>

        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : submitLabel}</Button>
        </div>
      </form>
    </div>
  </div>
);

const BlogManagementPanel = ({ onChanged, onManageComments, refreshKey = 0 }) => {
  const { data, loading, error: loadError, reload } = useAsync(
    () => api.get("/admin/blogs?includeDeleted=true"),
    [refreshKey],
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingBlog, setEditingBlog] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const blogs = useMemo(() => data?.blogs || [], [data?.blogs]);

  const filteredBlogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return blogs.filter((blog) => {
      const status = getBlogStatus(blog);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesQuery = !normalizedQuery
        || [blog.title, blog.slug, blog.category].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [blogs, query, statusFilter]);

  const refresh = async () => {
    await reload();
    await onChanged?.();
  };

  const closeForm = () => {
    setIsCreateOpen(false);
    setEditingBlog(null);
    setFormError("");
    setForm(emptyForm);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setEditingBlog(null);
    setIsCreateOpen(true);
  };

  const openEdit = (blog) => {
    setForm(getFormFromBlog(blog));
    setFormError("");
    setIsCreateOpen(false);
    setEditingBlog(blog);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editingBlog) {
        await api.patch(`/admin/blogs/${editingBlog._id}`, buildPayload(form));
      } else {
        await api.post("/admin/blogs", buildPayload(form));
      }
      closeForm();
      await refresh();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (blog) => {
    const status = getBlogStatus(blog);
    const nextAction = status === "published" ? "gỡ bài viết khỏi trang công khai" : "đăng bài viết này";
    if (!window.confirm(`Xác nhận ${nextAction}?`)) return;

    setActionError("");
    setActionLoading(`${blog._id}:publish`);
    try {
      await api.patch(`/admin/blogs/${blog._id}/${status === "published" ? "unpublish" : "publish"}`, {});
      await refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionLoading("");
    }
  };

  const deleteBlog = async (blog) => {
    if (!window.confirm(`Xóa bài viết "${blog.title}"?`)) return;
    setActionError("");
    setActionLoading(`${blog._id}:delete`);
    try {
      await api.delete(`/admin/blogs/${blog._id}`);
      await refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionLoading("");
    }
  };

  const restoreBlog = async (blog) => {
    if (!window.confirm(`Khôi phục bài viết "${blog.title}" về bản nháp?`)) return;
    setActionError("");
    setActionLoading(`${blog._id}:restore`);
    try {
      await api.patch(`/admin/blogs/${blog._id}/restore`, {});
      await refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionLoading("");
    }
  };

  const publishedCount = blogs.filter((blog) => getBlogStatus(blog) === "published").length;
  const featuredCount = blogs.filter((blog) => getBlogStatus(blog) !== "deleted" && blog.isFeatured).length;
  const deletedCount = blogs.filter((blog) => getBlogStatus(blog) === "deleted").length;

  return (
    <Card className="overflow-hidden border-teal-100 bg-white/95 p-0 shadow-xl shadow-teal-900/5">
      <div className="flex flex-col gap-4 border-b border-teal-50 bg-teal-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Quản trị nội dung</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Bài viết Blog</h2>
          <p className="mt-1 text-sm text-slate-500">
            {blogs.length - deletedCount} bài đang quản lý, {publishedCount} đã đăng, {featuredCount} nổi bật, {deletedCount} đã xóa.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>Tạo bài viết</Button>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-[1fr_220px]">
        <Input label="Tìm kiếm" placeholder="Tiêu đề, slug hoặc danh mục" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Tất cả</option>
          <option value="draft">Bản nháp</option>
          <option value="published">Đã đăng</option>
          <option value="deleted">Đã xóa</option>
        </Select>
      </div>

      {loadError || actionError ? (
        <p className="m-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{loadError || actionError}</p>
      ) : null}
      {loading ? <p className="p-5 text-sm font-semibold text-slate-500">Đang tải danh sách bài viết...</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="p-4">Bài viết</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4">Hiển thị</th>
              <th className="p-4 text-right">Tương tác</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBlogs.map((blog) => {
              const status = getBlogStatus(blog);
              return (
                <tr key={blog._id} className={status === "deleted" ? "bg-rose-50/40" : ""}>
                  <td className="max-w-md p-4">
                    <p className="font-black text-slate-900">{blog.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{blog.slug}</p>
                    <p className="mt-1 text-xs font-semibold text-teal-700">{blog.category}</p>
                  </td>
                  <td className="p-4"><BlogStatusBadge status={status} /></td>
                  <td className="p-4 text-xs font-semibold text-slate-600">
                    <p>Thứ tự: {blog.displayOrder || 0}</p>
                    <p className="mt-1">{blog.isFeatured ? "Nổi bật trang chủ" : "Bài thông thường"}</p>
                  </td>
                  <td className="p-4 text-right text-xs font-semibold text-slate-600">
                    <p>{blog.viewCount || 0} lượt xem</p>
                    <p className="mt-1">{blog.commentCount || 0} bình luận, {blog.ratingCount || 0} đánh giá</p>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      {status === "deleted" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-8 px-3 text-xs"
                          onClick={() => restoreBlog(blog)}
                          disabled={actionLoading.startsWith(`${blog._id}:`)}
                        >
                          {actionLoading === `${blog._id}:restore` ? "Đang khôi phục..." : "Khôi phục"}
                        </Button>
                      ) : (
                        <>
                          <Button type="button" variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => openEdit(blog)}>Sửa</Button>
                          <Button type="button" variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => onManageComments?.(blog)}>
                            Bình luận{blog.pendingCommentCount ? ` (${blog.pendingCommentCount})` : ""}
                          </Button>
                          <Button type="button" variant="muted" className="min-h-8 px-3 text-xs" onClick={() => togglePublish(blog)} disabled={actionLoading.startsWith(`${blog._id}:`)}>
                            {actionLoading === `${blog._id}:publish` ? "Đang xử lý..." : status === "published" ? "Gỡ đăng" : "Đăng bài"}
                          </Button>
                          <Button type="button" variant="danger" className="min-h-8 px-3 text-xs" onClick={() => deleteBlog(blog)} disabled={actionLoading.startsWith(`${blog._id}:`)}>
                            {actionLoading === `${blog._id}:delete` ? "Đang xóa..." : "Xóa"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredBlogs.length && !loading ? (
              <tr><td colSpan="5" className="p-6 text-center text-sm font-semibold text-slate-400">Không tìm thấy bài viết phù hợp.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isCreateOpen || editingBlog ? (
        <BlogFormModal
          title={editingBlog ? "Chỉnh sửa bài viết" : "Tạo bài viết"}
          form={form}
          setForm={setForm}
          error={formError}
          saving={saving}
          onClose={closeForm}
          onSubmit={submitForm}
          submitLabel={editingBlog ? "Lưu thay đổi" : "Tạo bài viết"}
        />
      ) : null}
    </Card>
  );
};

export default BlogManagementPanel;
