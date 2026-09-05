import os
import glob
from docx import Document
from docx.enum.text import WD_BREAK

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(SRC_DIR, "Libro Ecoaldeas Federadas - Completo.docx")

# Order: Index, then chapters 1-22, then Conclusion
files = []

# Find index first
index_files = glob.glob(os.path.join(SRC_DIR, "*Índice*.docx"))
files.extend(sorted(index_files))

# Chapters in numeric order
chapter_files = glob.glob(os.path.join(SRC_DIR, "*Capitulo *.docx"))

def chapter_num(f):
    name = os.path.basename(f)
    # Extract number after "Capitulo "
    parts = name.split("Capitulo ")
    if len(parts) > 1:
        num_str = parts[1].split(".")[0].split(" ")[0]
        try:
            return int(num_str)
        except:
            return 999
    return 999

chapter_files.sort(key=chapter_num)
files.extend(chapter_files)

# Conclusion last
conclusion_files = glob.glob(os.path.join(SRC_DIR, "*Conclusion*.docx"))
files.extend(sorted(conclusion_files))

print(f"Merging {len(files)} files in order:")
for f in files:
    print(f"  {os.path.basename(f)}")

# Create merged document
merged = Document()

for i, filepath in enumerate(files):
    if i > 0:
        # Add page break between documents
        merged.add_page_break()
    
    sub_doc = Document(filepath)
    
    for element in sub_doc.element.body:
        merged.element.body.append(element)

merged.save(OUT_FILE)
print(f"\nSaved: {OUT_FILE}")
print(f"Size: {os.path.getsize(OUT_FILE)} bytes")
