"""Build a Chinese study guide from its auditable Markdown source."""
from pathlib import Path
import argparse
import re
import unicodedata
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[2]
NAVY = colors.HexColor("#17314c")
TEAL = colors.HexColor("#167b86")
GRAY = colors.HexColor("#536273")
LIGHT = colors.HexColor("#eef4f7")

def glyph_ready(text):
    """Use embedded-font glyphs plus real PDF subscripts/superscripts."""
    text=escape(unicodedata.normalize("NFC",text))
    superscript=str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹","0123456789")
    text=re.sub(r"⁽([⁰¹²³⁴⁵⁶⁷⁸⁹]+)⁾",lambda m:"<super>("+m.group(1).translate(superscript)+")</super>",text)
    text=text.replace("ᵀ","<super>T</super>")
    subscript=str.maketrans("₀₁₂₃₄₅₆₇₈₉ᵢ","0123456789i")
    text=re.sub(r"[₀₁₂₃₄₅₆₇₈₉ᵢ]+",lambda m:"<sub>"+m.group().translate(subscript)+"</sub>",text)
    return text

def inline(text):
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", glyph_ready(text))

def build(source, output):
    pdfmetrics.registerFont(TTFont("CN", "C:/Windows/Fonts/msyh.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("CN-Bold", "C:/Windows/Fonts/msyhbd.ttc", subfontIndex=0))
    pdfmetrics.registerFontFamily("CN", normal="CN", bold="CN-Bold", italic="CN", boldItalic="CN-Bold")
    styles = {
        "title": ParagraphStyle("title", fontName="CN-Bold", fontSize=23, leading=34, textColor=NAVY, spaceAfter=10, wordWrap="CJK"),
        "heading": ParagraphStyle("heading", fontName="CN-Bold", fontSize=15, leading=23, textColor=NAVY, spaceAfter=9, wordWrap="CJK", keepWithNext=True),
        "sub": ParagraphStyle("sub", fontName="CN-Bold", fontSize=11.2, leading=18, textColor=TEAL, spaceBefore=10, spaceAfter=5, wordWrap="CJK", keepWithNext=True),
        "body": ParagraphStyle("body", fontName="CN", fontSize=10, leading=17, textColor=colors.HexColor("#223547"), spaceAfter=6, wordWrap="CJK", alignment=TA_LEFT),
        "bullet": ParagraphStyle("bullet", fontName="CN", fontSize=10, leading=17, textColor=colors.HexColor("#223547"), leftIndent=11, firstLineIndent=-9, spaceAfter=5, wordWrap="CJK"),
        "note": ParagraphStyle("note", fontName="CN", fontSize=9, leading=15, textColor=GRAY, spaceAfter=8, wordWrap="CJK"),
        "cell": ParagraphStyle("cell", fontName="CN", fontSize=8.8, leading=14, textColor=colors.HexColor("#223547"), wordWrap="CJK"),
        "headcell": ParagraphStyle("headcell", fontName="CN-Bold", fontSize=8.8, leading=14, textColor=colors.white, wordWrap="CJK"),
        "formula": ParagraphStyle("formula", fontName="CN", fontSize=9.4, leading=17, textColor=NAVY, wordWrap="CJK", spaceAfter=0),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=43, leftMargin=43, topMargin=53, bottomMargin=45,
                            title="考试范围、题型与知识点分析 | IDAT7224 录屏复习", author="", subject="根据两段用户提供录屏整理的中文考试复习分析")
    story=[]
    lines=source.read_text(encoding="utf-8").splitlines()
    i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:
            i+=1;continue
        if line=="---PAGE---":
            story.append(PageBreak());i+=1;continue
        if line.startswith("|"):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith("|"):
                row=[x.strip() for x in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?",x) for x in row):rows.append(row)
                i+=1
            n=len(rows[0]); ratios={2:[.27,.73],3:[.20,.36,.44],4:[.17,.26,.29,.28],5:[.12,.19,.19,.22,.28]}.get(n,[1/n]*n)
            data=[[Paragraph(inline(cell),styles["headcell" if r==0 else "cell"]) for cell in row] for r,row in enumerate(rows)]
            table=Table(data,colWidths=[doc.width*r/sum(ratios) for r in ratios],repeatRows=1,hAlign="LEFT")
            table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),NAVY),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),("ROWBACKGROUNDS",(0,1),(-1,-1),[LIGHT,colors.white]),("LINEBELOW",(0,-1),(-1,-1),.5,colors.HexColor("#cbd6df"))]))
            story.extend([table,Spacer(1,9)]);continue
        if line.startswith("```"):
            formula=[];i+=1
            while i<len(lines) and not lines[i].startswith("```"):
                leading=len(lines[i])-len(lines[i].lstrip())
                content="&#160;"*leading+glyph_ready(lines[i].lstrip())
                formula.append(Paragraph(content or " ",styles["formula"]));i+=1
            table=Table([[formula]],colWidths=[doc.width])
            table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),LIGHT),("BOX",(0,0),(-1,-1),.5,colors.HexColor("#cadce5")),("LEFTPADDING",(0,0),(-1,-1),11),("RIGHTPADDING",(0,0),(-1,-1),11),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9)]))
            story.extend([KeepTogether([table]),Spacer(1,8)]);i+=1;continue
        if line.startswith("# "):style="title";line=line[2:]
        elif line.startswith("## "):style="heading";line=line[3:]
        elif line.startswith("### "):style="sub";line=line[4:]
        elif line.startswith("> "):style="note";line=line[2:]
        elif line.startswith("- "):style="bullet";line="· "+line[2:]
        else:style="body"
        story.append(Paragraph(inline(line),styles[style]));i+=1

    def furniture(canvas, document):
        canvas.saveState();w,h=A4
        canvas.setStrokeColor(colors.HexColor("#d7e0e7"));canvas.setLineWidth(.5)
        canvas.line(43,h-35,w-43,h-35)
        canvas.setFont("CN",8);canvas.setFillColor(GRAY)
        canvas.drawString(43,h-27,"录屏复习分析 / EXAM STUDY GUIDE")
        canvas.drawRightString(w-43,h-27,"IDAT7224")
        canvas.line(43,33,w-43,33)
        canvas.drawString(43,21,"来源：用户提供的两段录屏 | 时间均为各文件内进度")
        canvas.drawRightString(w-43,21,f"{document.page}")
        canvas.restoreState()
    doc.build(story,onFirstPage=furniture,onLaterPages=furniture)
    return output

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--source",type=Path,default=ROOT/"output/pdf/exam-review-7215.md");parser.add_argument("--output",type=Path,default=ROOT/"output/pdf/exam-review-7215.pdf")
    args=parser.parse_args();print(build(args.source,args.output))
