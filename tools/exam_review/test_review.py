"""Run with the bundled Python: python -m unittest discover -s tools/exam_review."""
import html
import math
from pathlib import Path
import re
import unittest

import pdfplumber
from pypdf import PdfReader
from reportlab.pdfbase.ttfonts import TTFont

from calculations import DATA, training_example, backprop
from build_pdf import glyph_ready

ROOT=Path(__file__).resolve().parents[2]

class CalculationTests(unittest.TestCase):
    def test_sign_first_batch(self):
        steps=training_example("sign")
        self.assertEqual(steps[0]["weights"],[.01,.14,.26,-.22])
        self.assertEqual(steps[0]["delta"],[.01,.04,.06,.08])

    def test_sign_zero_and_frozen_batch_weights(self):
        point=training_example("sign")[0]["points"][1]
        self.assertEqual(point["z"],0)
        self.assertEqual(point["prediction"],0)
        self.assertEqual(point["error"],-1)

    def test_sign_second_batch(self):
        second=training_example("sign")[1]
        self.assertEqual(second["delta"],[0,0,0,0])
        self.assertEqual([p["z"] for p in second["points"]],[.19,-.17])

    def test_sign_final_all_training_points(self):
        weights=training_example("sign")[-1]["weights"]
        results=[sum(w*x for w,x in zip(weights,vector)) for vector,target in DATA]
        for value, expected in zip(results,[.01,.19,-.17,-.35]):
            self.assertAlmostEqual(value,expected)
        self.assertEqual([(z>0)-(z<0) for z in results],[y for x,y in DATA])

    def test_identity_first_batch(self):
        first=training_example("identity")[0]
        self.assertEqual(first["weights"],[.004,.134,.248,-.238])
        self.assertEqual([p["error"] for p in first["points"]],[1.4,-1])

    def test_identity_second_batch(self):
        second=training_example("identity")[1]
        self.assertEqual(second["weights"],[.00392,.15112,.26512,-.22088])
        self.assertEqual([p["error"] for p in second["points"]],[.852,-.860])

    def test_backprop_reported_numbers(self):
        r=backprop()
        self.assertAlmostEqual(r["output"],1.5231883119115297)
        self.assertAlmostEqual(r["dv"][0],1.1600513167719477)
        self.assertAlmostEqual(r["dw"][0],.6397000084492246)

    def test_backprop_finite_differences_for_all_parameters(self):
        # Non-symmetric parameters also catch exchanged layer factors.
        x,target,w,v=.7,-.2,[.8,-.4],[1.2,.9]
        analytic=backprop(x,target,w,v)
        epsilon=1e-6
        for kind in ("w","v"):
            for i in range(2):
                wp,wm,vp,vm=w.copy(),w.copy(),v.copy(),v.copy()
                plus,minus=(wp,wm) if kind=="w" else (vp,vm)
                plus[i]+=epsilon;minus[i]-=epsilon
                finite=(backprop(x,target,wp,vp)["loss"]-backprop(x,target,wm,vm)["loss"])/(2*epsilon)
                self.assertAlmostEqual(finite,analytic["d"+kind][i],places=7)

    def test_bad_activation_rejected(self):
        with self.assertRaises(ValueError):training_example("unknown")

class DeliverableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=(ROOT/"output/pdf/exam-review-7215.md").read_text(encoding="utf-8")
        cls.reader=PdfReader(ROOT/"output/pdf/exam-review-7215.pdf")
        cls.text="\n".join(p.extract_text() for p in cls.reader.pages)

    def test_thirteen_populated_pages(self):
        self.assertEqual(len(self.reader.pages),13)
        for page in self.reader.pages:self.assertGreater(len(page.extract_text()),500)

    def test_all_eight_question_types_and_boundaries(self):
        for s in ("#1 理论短文","#2 信息图","#3 评论与论证","#4 基础感知机","#5 换损失函数","#6 反向传播","#7 选择题","#8 拓扑短答"):
            self.assertIn(s,self.text)
        for s in ("不等于正式试卷必有八道题","具体题目未展示","独立推导","51:29-52:06"):
            self.assertTrue(re.sub(r"\s+","",s) in re.sub(r"\s+","",self.text),f"Missing boundary statement: {s}")

    def test_verified_results_present(self):
        for result in ("0.01, 0.14, 0.26, -0.22","0.00392, 0.15112, 0.26512, -0.22088","1.160051","0.639700"):
            self.assertIn(result,self.text)

    def test_all_rendered_glyphs_available(self):
        visible=html.unescape(re.sub(r"<[^>]+>","",glyph_ready(self.source)))
        for font_path in ("C:/Windows/Fonts/msyh.ttc","C:/Windows/Fonts/msyhbd.ttc"):
            face=TTFont("check",font_path,subfontIndex=0).face
            missing={c for c in visible if not c.isspace() and ord(c) not in face.charWidths}
            self.assertEqual(missing,set(),f"Unsupported glyphs: {missing}")

    def test_page_geometry_no_clipping_or_footer_collision(self):
        with pdfplumber.open(ROOT/"output/pdf/exam-review-7215.pdf") as pdf:
            for index,page in enumerate(pdf.pages,1):
                for char in page.chars:
                    self.assertGreaterEqual(char["x0"],40, f"Page {index}: left edge")
                    self.assertLessEqual(char["x1"],page.width-40, f"Page {index}: right edge")
                    if 40<char["top"]<page.height-40:
                        self.assertLessEqual(char["bottom"],page.height-44,f"Page {index}: footer collision")

    def test_chinese_fonts_embedded(self):
        names=set()
        for page in self.reader.pages:
            for font in page["/Resources"]["/Font"].get_object().values():
                font=font.get_object()
                descriptor=font.get("/FontDescriptor")
                if descriptor and "/FontFile2" in descriptor.get_object():names.add(str(font["/BaseFont"]))
        self.assertGreaterEqual(len(names),2)

    def test_no_meeting_participant_information(self):
        self.assertNotIn("@connect",self.text)
        self.assertNotRegex(self.text,r"u3\d{6}")
        self.assertNotIn("Meng Jiajing",self.text)

if __name__=="__main__":unittest.main()
