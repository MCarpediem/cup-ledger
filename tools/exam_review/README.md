# 录屏考试复习 PDF

本目录仅用于根据用户提供的 `C:/Users/1/7215-1.mp4` 与 `C:/Users/1/7215-2.mp4` 制作复习材料，不改变应用代码。

## 文件

- `output/pdf/exam-review-7215.md`：中文复习指南的可编辑原稿，含视频内时间索引。
- `output/pdf/exam-review-7215.pdf`：最终交付的 13 页 PDF。
- `build_pdf.py`：ReportLab 排版，嵌入微软雅黑字体，数学上下标使用排版标记。
- `calculations.py`：十进制精确复算两个感知机算例；解析计算 tanh 网络梯度。
- `test_review.py`：检查算例、有限差分梯度、文字覆盖、字体字形与嵌入、页数及边界。

## 生成与验证

在仓库根目录，用包含 `reportlab`、`pypdf`、`pdfplumber` 的 Python 执行：

```powershell
& 'C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' tools/exam_review/build_pdf.py
& 'C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -m unittest discover -s tools/exam_review -p 'test_*.py' -v
pdftoppm -r 95 -png output/pdf/exam-review-7215.pdf tmp/exam-video/review-page
```

语音转写、画面 OCR、模型与音轨均留在本机 `tmp/exam-video/` 临时目录，不加入本次 Git 提交。视频与音频不上传；依赖与模型的下载已获用户授权。

## 验证结果

- 16 项 PDF 专项测试全部通过，包括全部算例、四个参数梯度的有限差分、中文及数学字形、字体嵌入、13 页结构与内容边界。
- 最终 PDF 的 13 页已全部渲染并逐页检查，未发现缺字、裁切或页脚冲突。
- 仓库 `npm run check` 通过：文档检查通过、41 项单元测试通过、生产构建通过、49 项端到端测试通过，1 项为测试套件原有跳过。
- 常规沙箱中首次运行仓库测试遇到 esbuild `spawn EPERM`；在允许本地测试子进程的环境重新执行后通过。

## 内容边界

录屏课程画面标为 IDAT7224，不用文件名推断课程代码。八类练习是题型线索，不是正式试卷题量。第 #7、#8 题未展示具体题干；第 #6 的完整答案是独立推导，并非声称视频已公布。正式题量、分值、考试安排及期中/期末范围边界尚需正式通知。
