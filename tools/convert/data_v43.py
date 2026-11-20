"""Wangsa Mataram: people, relationships, notes and other chart content.

Conventions
  * A person's year is when they began to reign (or became heir / claimant / notable);
    the layout places them near that year on the time axis.
  * Single reigns are written with a spaced en dash ("r. 1755 – 1792"); multiple reigns
    use unspaced dashes with shortened years ("r. 1810–11, 1812–14"). Ongoing: "present".
  * Sub-lines join separate facts with " · " ("presumed heir · renamed 2015"); a marriage reads
    "m. 1974, div. 1984" and a lifespan "· 1921 – 2015".
  * Lines: solid = father to son; dotted = through a daughter or by marriage; grey =
    outside the dynasty. A line takes the colour of the house of the person it leads to;
    at a house pill it switches from the parent's colour to the new house's colour.
"""
from model import (NODES, TIES, beside, heir, legend, minor, neutral, ruler, text)


# ================================================================ people
# --- legendary ancestry (Babad Tanah Jawi); years only order the rows -----------
legend("lg_brawijaya", "mataram", 1470, "Prabu", "Brawijaya V", "last king of Majapahit")
legend("lg_bondan", "mataram", 1490, "Raden", "Bondan Kejawan", "“Lembu Peteng”")
legend("lg_getas", "mataram", 1505, "Ki Ageng", "Getas Pandawa")
legend("lg_sela", "mataram", 1520, "Ki Ageng", "Sela")
legend("lg_enis", "mataram", 1535, "Ki Ageng", "Enis")
LEGEND_ROW = ["lg_brawijaya", "lg_bondan", "lg_getas", "lg_sela"]   # drawn left to right on Enis's row
ROW_GAP = 64
_right = NODES["lg_enis"].l
for _id in reversed(LEGEND_ROW):          # the chronicle line bends: a row that turns down at Enis
    _n = NODES[_id]
    _n.x, _n.year = _right - ROW_GAP - _n.lw / 2, NODES["lg_enis"].year
    TIES[_id] = "lg_enis"
    _right = _n.l

# --- Mataram -----------------------------------------------------------------
minor("pamanahan", "mataram", 1556, "Ki Ageng", "Pamanahan", "d. c. 1584", trad=True, slot=True)
minor("juru", "mataram", 1556, "Ki", "Juru Martani", "first chief minister", trad=True)
neutral("benawa", 1586, "Pangeran Benawa", "of Pajang · son of<br>Sultan Hadiwijaya", w=190)
ruler("senapati", "mataram", 1587, "Panembahan", "Senapati", "r. c. 1587 – 1601", trad=True)
ruler("hanyakrawati", "mataram", 1601, "Panembahan", "Hanyakrawati", "r. 1601 – 1613")
beside("hanyakrawati", "r", text("banawati", 0, "Ratu Mas Banawati", "daughter of Pangeran Benawa · per chronicles"))
ruler("martapura", "mataram", 1613, "Adipati", "Martapura", "1613, one day", trad=True)
ruler("agung", "mataram", 1613, "Sultan", "Agung", "r. 1613 – 1645")
beside("agung", "r", text("ratuwetan", 0, "Ratu Wetan of Batang", "queen · identity uncertain"))
minor("pandansari", "mataram", 1630, "Ratu", "Pandansari", "Agung's sister")
beside("pandansari", "r", neutral("pekik", 0, "Pangeran Pekik", "of Surabaya · killed 1659", w=200))
minor("alit_am1", "mataram", 1646, "Pangeran", "Alit", "killed 1647/48")
ruler("am1", "mataram", 1646, "Susuhunan", "Amangkurat I", "r. 1646 – 1677")
beside("am1", "l", minor("ratukulon", "mataram", 0, "Ratu", "Kulon", "daughter of Pangeran Pekik of Surabaya"))
beside("am1", "r", text("ratumalang", 0, "Ratu Malang", "his beloved · d. 1665"))
neutral("trunajaya", 1677, "Trunajaya", "Madurese rebel, 1674 – 1680<br>not of the dynasty", w=190)
neutral("surapati", 1706, "Untung Surapati", "Balinese rebel, lord of<br>Pasuruan · not of the dynasty", w=210)
ruler("am2", "mataram", 1677, "Susuhunan", "Amangkurat II", "r. 1677 – 1703")
ruler("pb1", "mataram", 1704, "Susuhunan", "Pakubuwana I", "r. 1704 – 1719")
beside("pb1", "l", text("ratupb", 0, "Ratu Pakubuwana", "queen · patron of letters"))
minor("purbaya_p", "mataram", 1719, "Pangeran", "Purbaya", "rebelled 1719 – 1723")
ruler("am3", "mataram", 1703, "Susuhunan", "Amangkurat III", "r. 1703 – 1705")
minor("tepasana", "mataram", 1723, "Pangeran", "Tepasana", "son of Amangkurat III")
ruler("am4", "mataram", 1719, "Susuhunan", "Amangkurat IV", "r. 1719 – 1726")
ruler("am5", "mataram", 1742, "Susuhunan", "Amangkurat V", "“Sunan Kuning” · claimed 1742 – 1743", hatch=True)
ruler("pb2", "mataram", 1726, "Susuhunan", "Pakubuwana II", "r. 1726 – 1749 (interrupted 1742)")
beside("pb2", "l", minor("hemas_pb2", "mataram", 0, "GKR", "Hemas", "daughter of Pangeran Purbaya"))
minor("kpa_mn", "mataram", 1726, "KGPAA", "Mangkunegara", "exiled 1728")
minor("blitar_p", "mataram", 1719, "Pangeran", "Blitar", "rebelled 1719 – 1721")
beside("kpa_mn", "r", minor("wulan", "mataram", 0, "RAy.", "Wulan", "daughter of Pangeran Blitar · per chronicles"))

# --- Surakarta ---------------------------------------------------------------
SS = "Susuhunan"
ruler("pb3", "surakarta", 1749, SS, "Pakubuwana III", "r. 1749 – 1788")
beside("pb3", "l", text("beruk", 0, "GKR Kencana Beruk", "queen · by one account a dancer"))
neutral("yasadipura1", 1770, "Yasadipura I", "court poet<br>1729 – 1802/03", w=170)
neutral("yasadipura2", 1814, "Yasadipura II", "credited co-author of<br>the Serat Centhini", w=180)
neutral("ranggawarsita", 1845, "Ranggawarsita", "court poet<br>1802 – 1873", w=170)
ruler("pb4", "surakarta", 1788, SS, "Pakubuwana IV", "r. 1788 – 1820")
ruler("pb5", "surakarta", 1820, SS, "Pakubuwana V", "r. 1820 – 1823")
ruler("pb7", "surakarta", 1830, SS, "Pakubuwana VII", "r. 1830 – 1858")
ruler("pb8", "surakarta", 1858, SS, "Pakubuwana VIII", "r. 1858 – 1861")
ruler("pb6", "surakarta", 1823, SS, "Pakubuwana VI", "r. 1823 – 1830")
ruler("pb9", "surakarta", 1861, SS, "Pakubuwana IX", "r. 1861 – 1893")
ruler("pb10", "surakarta", 1893, SS, "Pakubuwana X", "r. 1893 – 1939")
beside("pb10", "l", minor("hemas_pb10", "yogyakarta", 0, "GKR", "Hemas", "daughter of Hamengkubuwana VII"))
beside("pb10", "r", minor("gkrpb", "mangkunegaran", 0, "GKR", "Pakubuwana", "daughter of Mangkunegara IV"))
neutral("mooryati", 1928, "Mooryati Soedibyo", "founder of Mustika Ratu<br>1928 – 2024", w=230)
ruler("pb11", "surakarta", 1939, SS, "Pakubuwana XI", "r. 1939 – 1945")
minor("djatikusumo", "surakarta", 1945, "GPH", "Djatikusumo", "first Army Chief of Staff")
minor("haryomataram", "surakarta", 1945, "KGPH", "Haryo Mataram", "first rector of UNS")
ruler("pb12", "surakarta", 1945, SS, "Pakubuwana XII", "r. 1945 – 2004")
ruler("pb13", "surakarta", 2004, SS, "Pakubuwana XIII", "r. 2004 – 2025")
beside("pb13", "l", text("winari", 0, "KRAy. Winari Sri Haryani", "second wife · divorced"))
beside("pb13", "r", text("asihwinarni", 0, "GKR Pakubuwana", "born Asih Winarni · queen"))
ruler("tedjowulan", "surakarta", 2004, "KGPA", "Tedjowulan", "claimed 2004 – 2012", hatch=True)
minor("moeng", "surakarta", 2004, "GKR", "Wandansari", "“Gusti Moeng” · former MP")
ruler("pb14h", "surakarta", 2025, SS, "Pakubuwana XIV", "Hangabehi · claimed 2025 – present", hatch=True)
ruler("pb14p", "surakarta", 2025, SS, "Pakubuwana XIV", "Purbaya · claimed 2025 – present", hatch=True)

# --- Yogyakarta --------------------------------------------------------------
SU = "Sri Sultan"
ruler("hb1", "yogyakarta", 1755, SU, "Hamengkubuwana I", "r. 1755 – 1792")
beside("hb1", "l", text("ratuageng", 0, "Ratu Ageng Tegalrejo", "queen · raised Diponegoro"))
ruler("hb2", "yogyakarta", 1792, SU, "Hamengkubuwana II", "r. 1792–1810, 1811–12, 1826–28")
ruler("hb3", "yogyakarta", 1810, SU, "Hamengkubuwana III", "regent 1810–11 · r. 1812–14")
minor("diponegoro", "yogyakarta", 1825, "Pangeran", "Diponegoro", "led the Java War, 1825 – 1830")
minor("pmangkubumi", "yogyakarta", 1825, "Pangeran", "Mangkubumi", "Java War commander")
minor("gkrmaduretno", "yogyakarta", 1800, "GKR", "Maduretno", "daughter of Hamengkubuwana II")
beside("gkrmaduretno", "l", text("ronggo", 0, "Ronggo Prawirodirjo III", "regent of Madiun · rebelled 1810"))
neutral("sentot", 1825, "Sentot Prawirodirjo", "Java War commander<br>c. 1808 – 1855", w=200)
neutral("kyaimaja", 1825, "Kyai Maja", "Diponegoro's religious<br>adviser · d. 1849", w=190)
beside("diponegoro", "r", minor("ramaduretno", "yogyakarta", 0, "RAy.", "Maduretno", "Diponegoro's queen · m. 1814"))
ruler("hb4", "yogyakarta", 1814, SU, "Hamengkubuwana IV", "r. 1814 – 1822")
ruler("hb5", "yogyakarta", 1822, SU, "Hamengkubuwana V", "r. 1822–26, 1828–55")
beside("hb4", "r", minor("ratuibu", "yogyakarta", 0, "GKR", "Kencana", "“Ratu Ibu” · a guardian of her son"))
minor("gustiahmad", "yogyakarta", 1855, "GRM", "Timur Muhammad", "“Gusti Ahmad” · bypassed heir")
ruler("hb6", "yogyakarta", 1855, SU, "Hamengkubuwana VI", "r. 1855 – 1877")
ruler("hb7", "yogyakarta", 1877, SU, "Hamengkubuwana VII", "r. 1877 – 1921")
ruler("hb8", "yogyakarta", 1921, SU, "Hamengkubuwana VIII", "r. 1921 – 1939")
minor("juminah", "yogyakarta", 1893, "KGPAA", "Hamengkunegara II", "“Juminah” · crown prince · set aside")
neutral("bagong", 1958, "Bagong Kussudiardja", "pioneer of modern dance<br>1928 – 2004", w=220)
neutral("butet", 1990, "Butet Kertaredjasa", "actor and monologist", w=190)
neutral("djaduk", 1990, "Djaduk Ferianto", "musician · 1964 – 2019", w=190)
ruler("hb9", "yogyakarta", 1940, SU, "Hamengkubuwana IX", "r. 1940 – 1988")
beside("hb9", "r", text("norma", 0, "KRAy. Nindyokirono", "born Norma Musa · of Bangka"))
ruler("hb10", "yogyakarta", 1989, SU, "Hamengkubuwana X", "r. 1989 – present")
beside("hb10", "l", neutral("hemas_hb10", 0, "Hemas", "queen consort · deputy chair<br>of the Senate (DPD) since 2024", w=200,
                            title="GKR"))
minor("yudhaningrat", "yogyakarta", 2001, "GBPH", "Yudhaningrat", "Sultan's half-brother")
minor("prabukusumo", "yogyakarta", 2001, "GBPH", "Prabukusumo", "Sultan's half-brother")
minor("hadiwinoto", "yogyakarta", 2001, "KGPH", "Hadiwinoto", "Sultan's brother · d. 2021")
heir("mangkubumi", "yogyakarta", 2015, "GKR", "Mangkubumi", "b. 1972 · presumed heir · renamed 2015", tag="disputed")
minor("condrokirono", "yogyakarta", 2015, "GKR", "Condrokirono", "b. 1975")
minor("maduretno", "yogyakarta", 2015, "GKR", "Maduretno", "b. 1978")
minor("hayu", "yogyakarta", 2015, "GKR", "Hayu", "b. 1983")
minor("bendara2", "yogyakarta", 2015, "GKR", "Bendara", "b. 1986")

# --- Pakualaman & Mangkualaman -------------------------------------------------
KG = "KGPAA"
ruler("pa1", "pakualaman", 1813, KG, "Paku Alam I", "r. 1813 – 1829")
ruler("pa2", "pakualaman", 1829, KG, "Paku Alam II", "r. 1829 – 1858")
beside("pa2", "r", minor("hayu_pa2", "yogyakarta", 0, "GKR", "Hayu", "daughter of Hamengkubuwana II · m. 1805"))
minor("suryaningrat", "pakualaman", 1866, "KPH", "Suryaningrat", "eldest son · passed over")
neutral("suryopranoto", 1915, "Suryopranoto", "“the Strike King”<br>National Hero", w=190)
ruler("pa3", "pakualaman", 1858, KG, "Paku Alam III", "r. 1858 – 1864")
minor("nataningprang", "pakualaman", 1846, "KPH", "Nataningprang")
ruler("pa4", "pakualaman", 1864, KG, "Paku Alam IV", "r. 1864 – 1878")
ruler("pa5", "pakualaman", 1878, KG, "Paku Alam V", "r. 1878 – 1900")
ruler("pa6", "pakualaman", 1901, KG, "Paku Alam VI", "r. 1901 – 1902")
minor("notodirojo", "pakualaman", 1901, "KPH", "Notodirojo", "chaired Budi Utomo, 1911 – 1914")
neutral("notosoeroto", 1918, "Noto Soeroto", "poet · 1888 – 1951", w=170)
ruler("pa7", "pakualaman", 1906, KG, "Paku Alam VII", "r. 1906 – 1937")
beside("pa7", "r", minor("retnopuwoso", "surakarta", 0, "GBRAy.", "Retno Puwoso", "daughter of Pakubuwana X"))
ruler("pa8", "pakualaman", 1937, KG, "Paku Alam VIII", "r. 1937 – 1998")
beside("pa8", "l", text("ratnaningrum", 0, "KRAy. Ratnaningrum", "senior wife"))
beside("pa8", "r", text("purnamaningrum", 0, "KRAy. Purnamaningrum", "junior wife"))
ruler("pa9", "pakualaman", 1999, KG, "Paku Alam IX", "r. 1999 – 2015")
ruler("pa10", "pakualaman", 2016, KG, "Paku Alam X", "r. 2016 – present")
heir("bimantoro", "pakualaman", 2019, "BPH", "Kusumo Bimantoro", "eldest son · presumed heir")
neutral("kihajar", 1922, "Ki Hajar Dewantara", "“Father of Indonesian<br>Education”", w=210)
beside("kihajar", "r", minor("nyihajar", "pakualaman", 0, "", "Nyi Hajar Dewantara", "led Taman Siswa, 1959 – c. 1970"))
ruler("anglingkusumo", "pakualaman", 2012, KG, "Mangku Alam I",
      "Anglingkusumo · claimed 2021 – 2022", hatch=True)
ruler("wiroyudho", "pakualaman", 2022, KG, "Mangku Alam II", "Wiroyudho · claimed 2022 – present",
      hatch=True)

# --- Mangkunegaran -------------------------------------------------------------
ruler("mn1", "mangkunegaran", 1757, KG, "Mangkunegara I", "r. 1757 – 1795")
beside("mn1", "r", text("rubiyah", 0, "Rubiyah “Matah Ati”", "wife · led his women soldiers (tradition)"))
beside("mn1", "l", minor("bendara", "yogyakarta", 0, "GKR", "Bendara",
                                "daughter of Hamengkubuwana I · m. c. 1746, div. 1763"))
minor("hamijaya", "mangkunegaran", 1776, "KPH", "Prabu Hamijaya")
beside("hamijaya", "r", minor("alit", "surakarta", 0, "GKR", "Alit", "daughter of Pakubuwana III"))
ruler("mn2", "mangkunegaran", 1796, KG, "Mangkunegara II",
      "r. 1796 – 1835")
minor("sekeli", "mangkunegaran", 1815, "BRAy.", "Sekeli", "m. KPH Hadiwijaya I")
minor("sayati", "mangkunegaran", 1815, "BRAy.", "Sayati", "m. KPH Natakusuma")
ruler("mn3", "mangkunegaran", 1835, KG, "Mangkunegara III", "r. 1835 – 1853")
ruler("mn4", "mangkunegaran", 1853, KG, "Mangkunegara IV", "r. 1853 – 1881")
beside("mn4", "r", minor("dunuk", "mangkunegaran", 0, "GRAy.", "Dunuk", "daughter of Mangkunegara III"))
ruler("mn5", "mangkunegaran", 1881, KG, "Mangkunegara V", "r. 1881 – 1896")
ruler("mn6", "mangkunegaran", 1896, KG, "Mangkunegara VI", "r. 1896 – 1916")
minor("suyono", "mangkunegaran", 1916, "KPA", "Suyono Handayaningrat", "the heir he wanted")
minor("suryokusumo", "mangkunegaran", 1910, "KPH", "Suryokusumo")
ruler("mn7", "mangkunegaran", 1916, KG, "Mangkunegara VII", "r. 1916 – 1944")
minor("partini", "mangkunegaran", 1925, "BRAy.", "Partini", "b. 1902")
beside("partini", "r", neutral("hoesein", 0, "Hoesein Djajadiningrat", "scholar · first Indonesian doctorate<br>by dissertation (Leiden, 1913)", w=230))
beside("mn7", "l", minor("timur", "yogyakarta", 0, "GKR", "Timur", "daughter of Hamengkubuwana VII"))
ruler("mn8", "mangkunegaran", 1944, KG, "Mangkunegara VIII", "r. 1944 – 1987")
beside("mn8", "r", minor("sunituti", "mangkunegaran", 0, "GKP", "Sunituti", "m. 1941"))
minor("retnosatuti", "mangkunegaran", 1969, "GRAy.", "Retno Satuti", "m. 1969")
beside("retnosatuti", "r", neutral("rahadian", 0, "Rahadian Yamin", "only son of<br>Mohammad Yamin", w=190))
minor("royyamin", "mangkunegaran", 2000, "KPH", "Roy Rahajasa Yamin", "throne candidate, 2021 – 2022")
minor("astrini", "mangkunegaran", 1975, "GRAy.", "Retno Astrini", "")
beside("astrini", "r", neutral("abubakar", 0, "Tunku Abu Bakar", "of the Johor<br>royal family", w=190))
minor("nurul", "mangkunegaran", 1933, "GRAy.", "Siti Nurul",
      "“Gusti Nurul” · 1921 – 2015")
ruler("mn9", "mangkunegaran", 1987, KG, "Mangkunegara IX", "r. 1987 – 2021")
beside("mn9", "l", neutral("sukmawati", 0, "Sukmawati Sukarnoputri", "m. 1974, div. 1984", w=230))
beside("mn9", "r", text("prisca", 0, "GKP Prisca Marina Haryogi Supardi", "m. 1990"))
neutral("sukarno", 1958, "Sukarno", "first President<br>of Indonesia", w=160)
minor("paundrakarna", "mangkunegaran", 2003, "GPH", "Paundrakarna", "actor and singer")
minor("putri", "mangkunegaran", 2003, "GRAy.", "Putri Agung")
minor("ancilla", "mangkunegaran", 2010, "GRAj.", "Ancillasura Marina", "m. KPH F.X. Adimas Rosdian, 6 Nov 2026")
ruler("mn10", "mangkunegaran", 2022, KG, "Mangkunegara X", "r. 2022 – present")

# --- Presidents ----------------------------------------------------------------
neutral("tien", 1947, "Tien Suharto", "First Lady, 1967 – 1996", w=200)
beside("tien", "r", neutral("suharto", 0, "Suharto", "second President<br>of Indonesia", w=170))
neutral("titiek", 1983, "Titiek Suharto", "m. 1983, div. 1998", w=200)
beside("titiek", "r", neutral("prabowo", 0, "Prabowo Subianto", "eighth President<br>of Indonesia", w=190))

# ================================================================ relationships
DESC = []   # descents: parent -> kids
MARR = []   # marriages: (a, b, house|None, style, couple_kids, kid_styles)


def descend(parent, kids, styles=None, brk=None, hop=False, caption=None, branch=False, drop=None, row=False,
            couple_of=None):
    """A parent's children. styles: {kid: 'dot'|'grey'|'legend'}; brk: {kid: label} marks omitted
    generations; hop: the line hops over lines it crosses (cross-house connections); drop:
    preferred distance from the parent's bottom to the horizontal line (leaves room for others);
    row: parent and child stand side by side on one row, joined left to right; couple_of: (a, b) of a
    marriage drawn with marry(a, b, ...): the line leaves the middle of that marriage line instead of
    the parent's box (for a child placed beside her own husband, so not in the couple's row)."""
    DESC.append(dict(parent=parent, kids=kids, styles=styles or {}, brk=brk or {},
                     hop=hop, caption=caption or {}, branch=branch, drop=drop, row=row,
                     couple_of=couple_of))


def daughter_to(father, spouse, drop=None):
    """a princess drawn from her father across to her husband's side"""
    descend(father, [spouse], styles={spouse: "dot"}, hop=True, drop=drop)


COUPLE_LINE = {}    # (a, b) -> house colour of the children's line when neither parent has one
# (a, b) -> -1 / +1: which side of the parent's other children a couple's children are placed
# (by default the side the wife stands on); keeps the long-standing order of the houses
COUPLE_SIDE = {("ratuageng", "hb1"): 0,       # 0 = the centre group: Hamengkubuwana II under the couple,
                                              # Paku Alam I to his left
               ("pa2", "hayu_pa2"): -1}       # Paku Alam III and Nataningprang left of Paku Alam V


def marry(a, b, house=None, couple=None, kid_styles=None, line=None):
    """a is drawn on the left, b on the right. house: colour of the marriage line
    (the incoming spouse's birth house); None = grey (non-royal). The children's line leaves the
    partner who carries the line (the one the other was placed beside), runs to the middle of the
    marriage line and drops from there."""
    MARR.append((a, b, house, "grey" if house is None else "dot", couple or [], kid_styles or {}))
    if line:
        COUPLE_LINE[(a, b)] = line


FOLLOW = {"sukarno": "sukmawati", "benawa": "banawati",   # nodes placed relative to another that move with it
          "trunajaya": "am2", "surapati": "am3"}   # outside figures beside the kings they fought or sheltered
FOLLOW_DX = {"sukarno": -150, "benawa": 0, "trunajaya": -420, "surapati": -420}   # offset from the node they follow


# Mataram
for _a, _b in [("lg_brawijaya", "lg_bondan"), ("lg_bondan", "lg_getas"), ("lg_getas", "lg_sela"),
               ("lg_sela", "lg_enis"), ("lg_enis", "pamanahan")]:
    descend(_a, [_b], styles={_b: "legend"}, row=_a in LEGEND_ROW)
descend("pamanahan", ["senapati"])
descend("senapati", ["hanyakrawati"])
descend("hanyakrawati", ["martapura"])
marry("hanyakrawati", "banawati", None, couple=["agung"])
marry("agung", "ratuwetan", "mataram", couple=["am1"])
descend("agung", ["alit_am1"])
descend("hanyakrawati", ["pandansari"], styles={"pandansari": "dot"})
marry("pandansari", "pekik", None)
descend("pandansari", ["ratukulon"], styles={"ratukulon": "dot"}, hop=True, couple_of=("pandansari", "pekik"))
descend("lg_sela", ["juru"], styles={"juru": "legend"}, brk={"juru": "grandson"})
descend("juru", ["ratuwetan"], styles={"ratuwetan": "dot"}, hop=True, brk={"ratuwetan": "descendant"})
descend("benawa", ["banawati"], styles={"banawati": "dot"}, hop=True)
marry("am1", "ratumalang", None)
marry("ratukulon", "am1", "mataram", couple=["am2"])
descend("am1", ["pb1"])
descend("am2", ["am3"])
descend("am3", ["tepasana"])
descend("tepasana", ["am5"])
marry("ratupb", "pb1", None, couple=["am4", "purbaya_p", "blitar_p"])
marry("hemas_pb2", "pb2", "mataram", couple=["pb3"])
daughter_to("purbaya_p", "hemas_pb2")
marry("beruk", "pb3", None, couple=["pb4"])
descend("pb3", ["yasadipura1"], styles={"yasadipura1": "grey"}, caption={"yasadipura1": "court poet"})
descend("yasadipura1", ["yasadipura2"], styles={"yasadipura2": "grey"})
descend("yasadipura2", ["ranggawarsita"], styles={"ranggawarsita": "grey"}, brk={"ranggawarsita": "grandson"})
descend("am4", ["hb1", "pb2", "kpa_mn"])
# Surakarta
descend("pb4", ["pb5", "pb7", "pb8"])
descend("pb5", ["pb6"])
descend("pb6", ["pb9"])
descend("pb9", ["pb10"])
descend("pb10", ["pb11", "djatikusumo", "haryomataram"])
descend("pb10", ["mooryati"], styles={"mooryati": "dot"}, brk={"mooryati": "granddaughter"}, drop=90)
marry("hemas_pb10", "pb10", "yogyakarta")
marry("pb10", "gkrpb", "mangkunegaran")
descend("pb11", ["pb12"])
descend("pb12", ["moeng", "pb13", "tedjowulan"], styles={"moeng": "dot"})
marry("winari", "pb13", None, couple=["pb14h"])
marry("pb13", "asihwinarni", None, couple=["pb14p"])
# Yogyakarta
descend("hb1", ["pa1"])
descend("hb2", ["gkrmaduretno", "hb3", "pmangkubumi"], styles={"gkrmaduretno": "dot"})
descend("hb2", ["kyaimaja"], styles={"kyaimaja": "dot"}, brk={"kyaimaja": "grandson"})
descend("pa3", ["nyihajar"], styles={"nyihajar": "dot"}, brk={"nyihajar": "granddaughter"}, hop=True)   # via KPH Sasraningrat
descend("hb2", ["ratuibu"], styles={"ratuibu": "dot"}, brk={"ratuibu": "granddaughter"}, hop=True)   # via GKR Hangger
marry("ronggo", "gkrmaduretno", None)
descend("ronggo", ["sentot"], styles={"sentot": "grey"})
descend("hb3", ["diponegoro", "hb4"])
marry("diponegoro", "ramaduretno", "yogyakarta")
descend("gkrmaduretno", ["ramaduretno"], styles={"ramaduretno": "dot"}, hop=True,
        couple_of=("ronggo", "gkrmaduretno"))
marry("ratuageng", "hb1", None, couple=["hb2"])
marry("hb4", "ratuibu", "yogyakarta", couple=["hb5", "hb6"])
descend("hb5", ["gustiahmad"])
descend("juminah", ["bagong"], brk={"bagong": "grandson"})
descend("bagong", ["butet", "djaduk"], styles={"butet": "grey", "djaduk": "grey"})
marry("hb9", "norma", None)
descend("hb9", ["yudhaningrat", "prabukusumo", "hadiwinoto", "hb10"])
descend("hb7", ["juminah", "hb8"])
for _a, _b in [("hb6", "hb7"), ("hb8", "hb9")]:
    descend(_a, [_b])
_daughters = ["mangkubumi", "condrokirono", "maduretno", "hayu", "bendara2"]
marry("hemas_hb10", "hb10", couple=_daughters, kid_styles={k: "dot" for k in _daughters})
# Pakualaman
descend("pa1", ["pa2"])
descend("pa2", ["pa5"])
descend("pa3", ["suryaningrat"])
descend("suryaningrat", ["suryopranoto", "kihajar"])
descend("nataningprang", ["pa4"])
descend("pa5", ["notodirojo", "pa6"])
descend("notodirojo", ["notosoeroto"], styles={"notosoeroto": "grey"})
marry("pa2", "hayu_pa2", "yogyakarta", couple=["pa3", "nataningprang"])
daughter_to("hb2", "hayu_pa2")
marry("kihajar", "nyihajar", "pakualaman")
for _a, _b in [("pa6", "pa7"), ("pa9", "pa10"), ("pa10", "bimantoro")]:
    descend(_a, [_b])
marry("pa7", "retnopuwoso", "surakarta", couple=["pa8"])
marry("ratnaningrum", "pa8", None, couple=["anglingkusumo"])
marry("pa8", "purnamaningrum", None, couple=["pa9"])
descend("anglingkusumo", ["wiroyudho"], styles={"wiroyudho": "dot"}, caption={"wiroyudho": "son-in-law"})
# Mangkunegaran
marry("kpa_mn", "wulan", "mataram", couple=["mn1"])
daughter_to("blitar_p", "wulan")
marry("mn1", "rubiyah", None, couple=["hamijaya"])
descend("mn6", ["suyono"])
marry("bendara", "mn1", "yogyakarta")
marry("hamijaya", "alit", "surakarta", couple=["mn2"])
descend("mn2", ["sekeli", "sayati"], styles={"sekeli": "dot", "sayati": "dot"})
descend("sekeli", ["mn4"], styles={"mn4": "dot"})
descend("sayati", ["mn3"], styles={"mn3": "dot"})
marry("mn4", "dunuk", "mangkunegaran", couple=["mn5", "mn6"])
descend("mn4", ["gkrpb"], styles={"gkrpb": "dot"}, hop=True, couple_of=("mn4", "dunuk"))
descend("mn5", ["mn7", "suryokusumo"])
marry("timur", "mn7", "yogyakarta", couple=["nurul"], kid_styles={"nurul": "dot"})
descend("mn7", ["mn8", "partini"], styles={"partini": "dot"})
marry("partini", "hoesein", None)
marry("retnosatuti", "rahadian", None, couple=["royyamin"], kid_styles={"royyamin": "dot"})
marry("astrini", "abubakar", None)
descend("suryokusumo", ["sunituti"], styles={"sunituti": "dot"})
marry("mn8", "sunituti", "mangkunegaran", couple=["mn9", "retnosatuti", "astrini"],
      kid_styles={"retnosatuti": "dot", "astrini": "dot"})
descend("sukarno", ["sukmawati"], styles={"sukmawati": "grey"})
marry("sukmawati", "mn9", None, couple=["paundrakarna", "putri"], kid_styles={"putri": "dot"})
marry("mn9", "prisca", None, couple=["ancilla", "mn10"], kid_styles={"ancilla": "dot"})
# Presidents
descend("mn3", ["tien"], styles={"tien": "dot"}, brk={"tien": "descendant"})
marry("tien", "suharto", None, couple=["titiek"], kid_styles={"titiek": "dot"}, line="mangkunegaran")
marry("titiek", "prabowo", None)
# princesses who married into another house
daughter_to("pb3", "alit", drop=110)
daughter_to("hb1", "bendara")
descend("hb7", ["hemas_pb10", "timur"], styles={"hemas_pb10": "dot", "timur": "dot"}, hop=True, branch=True)
daughter_to("pb10", "retnopuwoso")
daughter_to("mn3", "dunuk")

# house pills sit on the line leading into each house's first member
PILLS = {"pb3": ("SURAKARTA", "surakarta"), "hb1": ("YOGYAKARTA", "yogyakarta"),
         "pa1": ("PAKUALAMAN", "pakualaman"), "mn1": ("MANGKUNEGARAN", "mangkunegaran"),
         "anglingkusumo": ("MANGKUALAMAN", "pakualaman"), "pamanahan": ("MATARAM", "mataram")}
DISPUTED_PILLS = {"anglingkusumo"}

# rivals in the same row get a bracket
BRACKETS = [(["yudhaningrat", "prabukusumo", "hadiwinoto"], "REJECTED THE 2015 DECREES"),
            (["pb14h", "pb14p"], "DISPUTED SINCE 2025"),
            (["pb13", "tedjowulan"], "DISPUTED 2004 – 2012")]

# ================================================================ timeline
ERAS = [(1556, "Rise of Mataram"), (1677, "Mataram under the VOC"),
        (1755, "The divided kingdoms"), (1830, "The Dutch Vorstenlanden"),
        (1942, "Occupation and revolution"), (1950, "Courts in the Republic")]
EPISODES = [(1674, 1680, "Trunajaya Rebellion"),
            (1704, 1708, "First War of Succession"), (1719, 1723, "Second War of Succession"),
            (1740, 1743, "Chinese War"), (1746, 1757, "Third War of Succession"),
            (1811, 1816, "British rule"), (1825, 1830, "Java War")]

# ================================================================ house headers, crowns, notes
EMB = "assets/emblems/"
# house header beside the pill on the line into a house's first member:
# member id -> (image, kind, name, years, seat, founding caption)
HEADERS = {
    "pamanahan": (None, "Sultanate of", "Mataram", "c. 1587 – 1755",
                  "Kotagede · Kerta · Plered · Kartasura · Surakarta", "Granted by the Sultan of Pajang, c. 1556"),
    "pb3": (EMB + "surakarta.png", "Sunanate of", "Surakarta", "1755 – present",
            "Keraton Surakarta Hadiningrat", "Capital since 1745; kingdom split at Giyanti, 1755"),
    "hb1": (EMB + "yogyakarta.png", "Sultanate of", "Yogyakarta", "1755 – present",
            "Keraton Ngayogyakarta Hadiningrat", "Treaty of Giyanti, 1755"),
    "pa1": (EMB + "pakualaman.png", "Principality of", "Pakualaman", "1813 – present",
            "Pura Pakualaman, Yogyakarta", "Created under British rule, 1813"),
    "mn1": (EMB + "mangkunegaran.png", "Principality of", "Mangkunegaran", "1757 – present",
            "Pura Mangkunegaran, Surakarta", "Treaty of Salatiga, 1757"),
    "anglingkusumo": (EMB + "mangkualaman.png", "Self-proclaimed", "Mangkualaman", "2021 – present",
                      "not recognised by the state", "Declared by Anglingkusumo"),
}

# crowns: order of reign within each court (a ruler with several reigns has several numbers)
CROWNS = {
    "senapati": "1", "hanyakrawati": "2", "martapura": "3", "agung": "4", "am1": "5", "am2": "6", "am3": "7",
    "pb1": "8", "am4": "9", "pb2": "10",
    "pb3": "1", "pb4": "2", "pb5": "3", "pb6": "4", "pb7": "5", "pb8": "6", "pb9": "7", "pb10": "8", "pb11": "9",
    "pb12": "10", "pb13": "11",
    "hb1": "1", "hb2": "2 · 4 · 8", "hb3": "3 · 5", "hb4": "6", "hb5": "7 · 9", "hb6": "10", "hb7": "11",
    "hb8": "12", "hb9": "13", "hb10": "14",
    **{f"pa{i}": str(i) for i in range(1, 11)},
    **{f"mn{i}": str(i) for i in range(1, 11)},
}

# short event labels set on the line into a person (UsefulCharts style)
EVENTS = {"am2": "TRUNAJAYA TAKES PLERED · 1677", "pb1": "PROCLAIMED AT SEMARANG · 1704"}

# art direction: per-person nudges applied after the automatic layout, {id: (dx, dy)};
# dx moves the person with everyone below them, dy moves the person's row
NUDGE = {"ratuibu": (80, 0), "kyaimaja": (40, 0),   # room for the line from Hamengkubuwana II down to Kencana
         "asihwinarni": (36, 0), "prisca": (50, 0),     # their child under the marriage line: a straight drop
         "gkrmaduretno": (266, 0), "sentot": (-274, 0),   # under his father Ronggo, clear of the line to his half-sister
         "hb9": (0, 10),        # his crown clear of the line from Pakubuwana X to Retno Puwoso
         "alit_am1": (2380, 0)}  # beside his brother's queen rather than far out on the left

SHARE_BUS = {"kyaimaja", "ratuibu", "nyihajar"}   # hangs off the parent's existing line (a grandson: the break mark tells the generation)
BREAK_AT = {"ratuibu": 0.8, "bagong": 0.3}   # break mark this far down its line (default half way): Ratu Ibu's below Kyai Maja's card, Bagong's above the dotted line it crosses
MARKER_TOP = {"am4"}   # letter marker at the top right corner, clear of a line under the box
TEXT_LIFT = {"ratnaningrum": 8, "purnamaningrum": 8}   # spouse labels lifted off an era line (px)

# notes shown in full beside their person; every other note becomes a numbered marker
INLINE_NOTES = {"abubakar", "agung", "alit_am1", "am3", "anglingkusumo", "blitar_p", "djatikusumo",
                "hayu_pa2", "juminah", "kihajar", "kyaimaja", "mangkubumi", "martapura", "mn10", "mn4",
                "norma", "nurul", "pamanahan", "pb12", "pb14p", "pb2", "pekik", "prabukusumo", "purbaya_p",
                "ranggawarsita", "ratuageng", "ratuibu", "ratumalang", "ratupb", "ronggo", "rubiyah",
                "senapati", "sentot", "surapati", "suryopranoto", "suyono", "tedjowulan", "trunajaya",
                "wiroyudho", "wulan"}

# (anchor id, side 'r' / 'l' / 'b', dx, dy, width, html)
NOTES = [
    ("pamanahan", "r", 0, -8, 320, "Granted the land of Mataram by the Sultan of Pajang (traditionally 1556; "
     "settled in the 1570s)."),
    ("senapati", "r", 0, -40, 330, "Court tradition tells of his union with <b>Ratu Kidul</b>, queen of the "
     "Southern Ocean (legend)."),
    ("martapura", "l", 0, 0, 300, "The chronicles say he was enthroned for a single day before giving way to his "
     "half-brother; no other source records the reign."),
    ("agung", "r", 260, 0, 330, "Besieged Dutch Batavia in <b>1628</b> and <b>1629</b>. Took the title of Sultan "
     "in 1641. National Hero (1975)."),
    ("juru", "b", 0, 6, 280, "Senapati's uncle and strategist; Mataram's first patih. By tradition "
     "a descendant (great-granddaughter in most genealogies), Ratu Wetan of Batang, was Sultan "
     "Agung's queen."),
    ("benawa", "r", 0, 0, 280, "His father Hadiwijaya (“Jaka Tingkir”) of Pajang adopted the young "
     "Senapati, who helped him oust Arya Pangiri (c. 1586–87); Benawa then ruled Pajang as "
     "Mataram's vassal. By tradition his daughter's son was Sultan Agung."),
    ("pekik", "r", 0, 0, 280, "Of the old Surabaya royal line; Amangkurat I had him and his family "
     "killed in 1659."),
    ("alit_am1", "r", 0, 0, 280, "Killed attacking the palace; the king then had 5,000–6,000 ulama and their "
     "families massacred (per the VOC envoy Van Goens)."),
    ("ratumalang", "r", 0, 0, 260, "On her death the king had dozens of palace women executed (VOC report); "
     "her tomb is at Gunung Kelir."),
    ("trunajaya", "r", 0, -70, 300, "Grandson of Cakraningrat I of Madura and son-in-law of Raden Kajoran; "
     "took Plered in 1677. Amangkurat II killed him himself in 1680."),
    ("surapati", "b", 0, 6, 300, "His men killed the VOC's Captain Tack at Kartasura (1686); he sheltered "
     "Amangkurat III."),
    ("am1", "r", 0, 0, 330, "In <b>1677</b> Trunajaya's rebels sacked his capital at Plered; he died while fleeing."),
    ("ratupb", "l", 0, 0, 300, "Sponsored the Islamic–Javanese <i>Carita Sultan Iskandar</i> and "
     "<i>Kitab Usulbiyah</i> (c. 1729–30) and guided the young Pakubuwana II."),
    ("purbaya_p", "l", 0, -50, 280, "With his brother Pangeran Blitar he led the <b>Second War of Succession</b> "
     "against Amangkurat IV; exiled 1723."),
    ("yasadipura1", "b", 0, 6, 280, "Traditionally credited with reworking the <i>Serat Rama</i> and <i>Dewaruci</i>; "
     "Pakubuwana IV offered him the post of patih, which he declined."),
    ("ranggawarsita", "b", 0, 6, 280, "The last great court poet; his <i>Serat Kalatidha</i> named the "
     "“age of madness” (zaman edan)."),
    ("djatikusumo", "b", 0, 6, 260, "Son of Pakubuwana X; studied at Delft. National Hero (2002)."),
    ("pb1", "r", 0, -10, 340, "Prince Puger. Took the throne from his nephew with VOC help in the "
     "<b>First War of Succession</b> (1704–08)."),
    ("am3", "l", 0, 30, 260, "Exiled to <b>Ceylon</b> by the VOC in 1708. His first wife, Puger's daughter "
     "Raden Ayu Lembah, was executed for an affair (chronicles), which embittered him against her "
     "father."),
    ("am5", "l", 0, -6, 300, "Grandson of Amangkurat III, crowned by Chinese and Javanese rebels who took "
     "Kartasura in <b>1742</b>."),
    ("am4", "r", 0, -4, 330, "Survived the <b>Second War of Succession</b> (1719–23) against his brothers "
     "and an uncle."),
    ("pb2", "r", 0, -14, 360, "Moved the court to <b>Surakarta</b> in 1745. On his deathbed in <b>1749</b> "
     "he ceded the kingdom to the VOC."),
    ("kpa_mn", "r", 0, -10, 320, "Exiled by the VOC in 1728 (Batavia, then Ceylon and the Cape of Good Hope); "
     "d. c. 1738, reportedly reburied at Imogiri."),
    ("hb1", "l", 0, -70, 330, "Prince Mangkubumi. Proclaimed rival Susuhunan in 1749; the <b>Treaty of "
     "Giyanti</b> (1755) made him Sultan of half the kingdom. National Hero (2006)."),
    ("mn1", "r", 170, -12, 300, "Raden Mas Said, “Pangeran Sambernyawa”. The <b>Treaty of Salatiga</b> (1757) "
     "gave him part of Surakarta's lands. National Hero (1988)."),
    ("mn2", "r", 0, 0, 300, "Raised the <b>Legiun Mangkunegaran</b> (1808), a Napoleonic-style legion."),
    ("pa1", "r", 0, -16, 300, "Sided with the British, who stormed Yogyakarta's palace in 1812, and was "
     "rewarded with the <b>Pakualaman</b> (1813), which had its own small army, the Pakualaman Legion."),
    ("diponegoro", "b", 0, 6, 300, "Eldest son of Hamengkubuwana III by a secondary wife, RAy. Mangkarawati, and so not in line for the throne. "
     "National Hero (1973)."),
    ("pb6", "r", 0, 0, 250, "Exiled to <b>Ambon</b> in 1830, suspected of backing Diponegoro. National Hero (1964)."),
    ("ratuageng", "l", 0, -60, 300, "Raised her great-grandson Diponegoro at Tegalrejo; credited with training "
     "the palace's female guard. Mother of Hamengkubuwana II."),
    ("ronggo", "l", 0, 0, 300, "Rose against Governor-General Daendels and was killed in 1810, a prelude "
     "to the Java War."),
    ("sentot", "r", 0, 0, 250, "Son of Ronggo by a secondary wife; surrendered in 1829."),
    ("kyaimaja", "r", 0, 0, 260, "Son of Hamengkubuwana III's sister; died in exile in Minahasa, 1849."),
    ("ratuibu", "r", 0, 0, 300, "Daughter of the patih Danureja II and GKR Hangger, a daughter of Hamengkubuwana II; mother of Hamengkubuwana V and VI."),
    ("gustiahmad", "b", 0, 6, 300, "Born 13 days after his father's death in 1855; his uncle took the throne, "
     "and he died in exile in Manado."),
    ("juminah", "l", 0, 0, 300, "Hamengkubuwana VII named three crown princes before Hamengkubuwana VIII; "
     "Juminah, invested in 1893, was removed, officially on grounds of health."),
    ("hb7", "r", 0, 0, 300, "Known as “Sultan Sugih”, the rich Sultan: 17 sugar mills were founded in his reign. His sons, among them "
     "Tejokusumo, founded Krida Beksa Wirama (1918), the first dance school outside the palace."),
    ("norma", "r", 0, 0, 280, "Married 1976; she lived 1930–2015. His companion during his "
     "vice-presidency."),
    ("hb5", "b", 0, 6, 300, "Put on the throne as a child; set aside 1826–28 while the Dutch restored "
     "Hamengkubuwana II."),
    ("mn4", "l", 0, -6, 300, "Mangkunegara IV wrote the <i>Serat Wedhatama</i>; his <i>Puspawarna</i> flew "
     "on the <b>Voyager</b> Golden Record (1977). He founded the Colomadu (1861) and Tasikmadu (1871) "
     "sugar mills."),
    ("nurul", "l", 0, -4, 300, "Danced at Princess Juliana's wedding (1937); turned down Sukarno, Sjahrir "
     "and Hamengkubuwana IX; married her cousin, Lt. Col. Sujarso Surjosurarso, in 1954."),
    ("pb11", "r", 0, 0, 280, "The Dutch chose him over Kusumayuda, the son Pakubuwana X preferred."),
    ("mn7", "r", 0, 0, 280, "Studied at Leiden; co-founded <b>SRV</b> (1933), the first Indonesian-owned "
     "radio station."),
    ("mn8", "b", 0, 6, 300, "Recognised by Sukarno in 1945 as head of a special region beside the Sunan's; its "
     "suspension in June 1946 ended Mangkunegaran self-rule."),
    ("pa8", "r", 0, -4, 300, "Deputy Governor of Yogyakarta 1950–88, then acting Governor until his death in 1998. National Hero (2022)."),
    ("hb9", "l", 0, -40, 340, "Hosted the Republic's capital in Yogyakarta (1946–49). Yogyakarta became a "
     "<b>Special Region</b> in 1950 with the Sultan as Governor. <b>Vice President</b> of Indonesia 1973–78. National Hero (1990)."),
    ("pb12", "r", 0, -6, 300, "Surakarta's special-region status was suspended in <b>1946</b>; it was folded "
     "into Central Java in 1950. It has since been a ceremonial court."),
    ("mooryati", "b", 0, 6, 360, "Deputy Speaker of the People's Consultative Assembly (MPR), 2004–09."),
    ("rubiyah", "r", 0, 0, 280, "By tradition a cleric's daughter from Matah, near Nglaroh, who led Raden Mas Said's "
     "corps of women soldiers; a woman soldier of his court kept a diary of court life, 1781–91."),
    ("wulan", "r", 0, 0, 260, "Mother of Mangkunegara I; sources differ on her father's line."),
    ("blitar_p", "r", 0, 0, 260, "Son of Pakubuwana I; led the 1719 revolt with his brother Purbaya."),
    ("suyono", "b", 0, 6, 280, "The Dutch refused him as heir, and Mangkunegara VI abdicated in 1916, "
     "the only Mangkunegara to abdicate."),
    ("abubakar", "b", 0, 6, 260, "A grandson of Sultan Ismail of Johor: a royal marriage across the Strait."),
    ("hayu_pa2", "r", 0, 0, 280, "Aunt of Diponegoro; mother of Paku Alam III and grandmother of Paku Alam IV."),
    ("suryopranoto", "b", 0, 6, 260, "Led Sarekat Islam strikes and founded the sugar workers' union; "
     "Ki Hajar's elder brother."),
    ("nyihajar", "r", 0, 0, 260, "Born Sutartinah, daughter of KPH Sasraningrat, a son of Paku Alam III, "
     "and so Ki Hajar's cousin; shared his Dutch exile, 1913–19."),
    ("notosoeroto", "b", 0, 6, 280, "Dutch-language poet; co-founded the Indische Vereeniging (later "
     "Perhimpunan Indonesia); secretary to his friend Mangkunegara VII."),
    ("kihajar", "b", 0, 6, 240, "Founded Taman Siswa (1922); first Minister of Education. National Hero (1959)."),
    ("pb10", "b", 230, 8, 300, "National Hero (2011)."),
    ("mangkubumi", "b", 0, 8, 360, "In 2015 the Sultan issued decrees changing his own title, dropping "
     "the Islamic, male “Khalifatullah”, and renaming her <b>Mangkubumi</b>, the traditional name of the "
     "crown prince. This was widely read as naming her heir, though she has not been formally installed."),
    ("anglingkusumo", "r", 0, -6, 340, "Son of Paku Alam VIII by Ratnaningrum, the wife ranked senior; proclaimed rival "
     "Paku Alam IX in 2012, after his elder brother Probokusumo's 1998 candidacy failed. Founded the <b>Mangkualaman</b> in 2021."),
    ("wiroyudho", "r", 0, 0, 330, "The Mangkualaman is a self-proclaimed court with no recognition "
     "from the Indonesian state."),
    ("pb14p", "r", 0, -14, 420, "Purbaya, crown prince since 2022, proclaimed himself on 5 Nov 2025 and was "
     "crowned on 15 Nov. His elder half-brother Hangabehi, named by a family council backed by the court's customary council on "
     "13 Nov 2025, was crowned on 5 Sep 2026. Unresolved. The two are half-brothers: Purbaya by the queen, "
     "Hangabehi by a divorced wife."),
    ("prabukusumo", "t", 0, -72, 560, "The Sultan's brothers rejected the <b>2015 decrees</b> as contrary to "
     "palace custom (paugeran), which passes the throne to a son. In 2020 he removed Prabukusumo and "
     "Yudhaningrat from their palace posts."),
    ("tedjowulan", "b", 0, 8, 300, "Since January 2026 the government-appointed custodian of the palace "
     "heritage site (Culture Ministry decree 8/2026); has not endorsed either claimant to Pakubuwana XIV."),
    ("mn10", "b", -80, 8, 330, "Chosen in 2022 over his elder half-brother Paundrakarna, a grandson of Sukarno."),
]

# (group, title, expansion, English gloss)
GLOSSARY = [
    ("Rulers", "Susuhunan", "", "Sovereign (Sunan); “Emperor” to the Dutch"),
    ("Rulers", "Sultan", "", "Muslim sovereign"),
    ("Rulers", "Panembahan", "", "Lord"),
    ("Rulers", "Adipati", "", "Duke"),
    ("Rulers", "KGPAA", "Kanjeng Gusti Pangeran Adipati Arya (…Anom for a crown prince)", "Prince Regnant"),
    ("Rulers", "Patih", "", "Grand vizier, chief minister"),
    ("Honorifics", "Sri", "", "“Radiant”, honorific of a monarch"),
    ("Honorifics", "Gusti", "", "Lord / Lady of royal birth"),
    ("Honorifics", "Raden", "", "Noble (Javanese aristocracy)"),
    ("Honorifics", "Raden Mas", "", "Young nobleman (birth name)"),
    ("Honorifics", "GRM", "Gusti Raden Mas", "Prince (birth name)"),
    ("Honorifics", "Ki", "", "Elder, master"),
    ("Honorifics", "Ki Ageng", "", "Venerable elder"),
    ("Honorifics", "Prabu", "", "King"),
    ("Honorifics", "Kyai", "", "Religious teacher"),
    ("Honorifics", "Nyi", "", "Married woman (cf. Ki)"),
    ("Honorifics", "Tunku", "", "Malay royal title (Johor)"),
    ("Princes", "Pangeran", "", "Prince"),
    ("Princes", "KGPA", "Kanjeng Gusti Pangeran Adipati", "Senior prince"),
    ("Princes", "KPA", "Kanjeng Pangeran Arya", "Prince"),
    ("Princes", "KPH", "Kanjeng Pangeran Harya", "Prince"),
    ("Princes", "KGPH", "Kanjeng Gusti Pangeran Harya", "Prince"),
    ("Princes", "GBPH", "Gusti Bendara Pangeran Harya", "Prince"),
    ("Princes", "BPH", "Bendara Pangeran Harya", "Prince"),
    ("Princes", "GPH", "Gusti Pangeran Harya", "Prince"),
    ("Women", "Ratu", "", "Queen / senior princess"),
    ("Women", "Ratu Ageng", "", "Senior or dowager queen"),
    ("Women", "Ratu Mas", "", "Queen (honorific)"),
    ("Women", "GKR", "Gusti Kanjeng Ratu", "Queen Consort / Princess"),
    ("Women", "GKP", "Gusti Kanjeng Putri", "Princess Consort"),
    ("Women", "GBRAy.", "Gusti Bendara Raden Ayu", "Princess"),
    ("Women", "BRAy.", "Bendara Raden Ayu", "Princess"),
    ("Women", "KRAy.", "Kanjeng Raden Ayu", "Royal consort"),
    ("Women", "RAy.", "Raden Ayu", "Noblewoman (married)"),
    ("Women", "GRAy.", "Gusti Raden Ayu", "Princess"),
    ("Women", "GRAj.", "Gusti Raden Ajeng", "Princess (unmarried)"),
]

TITLE_TEXT = (
    "Founded in the 16th century, the Sultanate of Mataram came to rule most of Java. Civil wars and "
    "European intervention between 1755 and 1813 split it into four royal houses that survive today: the "
    "<b>Surakarta</b> Sunanate and the <b>Mangkunegaran</b> in Solo, and the <b>Yogyakarta</b> Sultanate "
    "and the <b>Pakualaman</b> in Yogyakarta.")

CAVEATS = [   # footnotes for facts that remain uncertain
    "<b>Notes on uncertain points.</b> The ancestry before Pamanahan, back to Brawijaya V of Majapahit, follows "
    "the Babad Tanah Jawi and is legendary. Dates before 1613 are traditional, from court chronicles compiled "
    "mostly in the 18th century (alternatives include 1582 or 1586/87 for the kingdom's founding and 1575 or "
    "1584 for Pamanahan's death); Mataram rulers appear in Dutch VOC records from 1613–14 (de Graaf; "
    "Ricklefs). Only Sultan Agung used the title Sultan, from 1641; his successors were styled Susuhunan. Mataram used no fixed heraldic emblem; the "
    "red flag often shown for it appears to derive from 18th-century Dutch flag charts, where it is labelled "
    "Japara. The courts' "
    "emblems date from the 19th and 20th centuries.",
    "Paku Alam reigns are dated from formal installation; Paku Alam I was appointed de facto on 29 June 1812, "
    "and a regency council ran the Pakualaman 1902–06. Nataningprang is also styled GPH or GRMH (Gusti Raden Mas Harya); he died "
    "before his father (d. 1858) and so never succeeded.",
    "Getas Pandawa is also spelled Getas Pendawa, Bondan Kejawan Bondan Kajawan, Enis Anis, Pandansari "
    "Wandansari and Blitar Balitar. "
    "Crowns count reigns within each court: Surakarta's from Pakubuwana III (the court itself counts "
    "Pakubuwana II, who moved to Surakarta in 1745, as its first Sunan), and Hamengkubuwana III's regency of "
    "1810–11 is counted as a reign. Hamengkubuwana IV's death is dated 1822 (some sources 1823). "
    "Prabu Hamijaya is also spelled Prabu Amijaya. Bendara's marriage is dated 1746 or 1747. KPA "
    "Mangkunegara's exile route and death date vary between sources.",
    "Tien Suharto's descent from Mangkunegara III runs through her mother (she is often called his canggah, "
    "great-great-grandchild); the line is not fully documented.",
    "Pakubuwana XII never named a queen, so no son had a clear claim, and the succession split in 2004. "
    "The Surakarta succession has been disputed since November 2025; a January 2026 court order concerns only "
    "Purbaya's civil-registry name and does not decide the succession (a challenge to it was ruled inadmissible "
    "on procedural grounds in July 2026; no appeal outcome has been reported). The Mangkualaman has no state "
    "recognition, and its dates (2021–22) vary between sources.",
]
