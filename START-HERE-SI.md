# VEXORA Studio — පටන්ගන්න මෙතැනින්

## Linux පරිගණකයේ ධාවනය කිරීම

1. `VEXORA-Source.zip` හෝ `VEXORA-Repository.zip` download කර Extract කරන්න.
2. Extract කළ `vexora-studio` folder එක විවෘත කරන්න.
3. එම folder එකේ Terminal එකක් විවෘත කර පහත commands දෙක ධාවනය කරන්න:

   ```bash
   chmod +x run-linux.sh
   ./run-linux.sh
   ```

4. Browser එකේ `http://127.0.0.1:4173/` විවෘත වෙයි. Automatically open නොවුණොත් ඒ address එක browser එකේ දාන්න.
5. Software එක නවත්වන්න Terminal එකට ගිහින් `Ctrl+C` ඔබන්න.

මෙම ක්‍රමයට `npm install` අවශ්‍ය නැහැ. Browser එකේ files open කිරීම local computer එකට සීමා වෙනවා; remote AI service එකකට design එක upload කරන්නේ නැහැ.

## Design එකක් හදන්නේ කොහොමද?

- වම් පැත්තේ tools වලින් Rectangle, Ellipse, Line, Pencil/Pen path හෝ Text tool එකක් තෝරන්න.
- Canvas එක මත mouse එක drag කර shape එකක් අඳින්න. Text සඳහා canvas එක click කර text dialog එක භාවිත කරන්න.
- Object එකක් select කර දකුණු Inspector එකෙන් color, stroke, position, size, opacity සහ text properties වෙනස් කරන්න.
- Freehand path එකක් select කර `A` / Node tool තෝරා එහි points සංස්කරණය කරන්න.
- `Ctrl+Z` Undo, `Ctrl+Shift+Z` Redo.
- **Save** මඟින් `.vex` project file එක download කරගන්න.
- **Export** මඟින් SVG හෝ PNG ලබාගන්න.
- `File → Open` මඟින් `.vex`, JSON හෝ basic SVG file එකක් විවෘත කරන්න.
- `Smart Studio` තුළ offline commands භාවිත කරන්න. උදාහරණයක්: `Create a maroon circle and text "VEXORA"`.

## Git repository එක GitHub වෙත දාන්න

`VEXORA-Repository.zip` එකේ local `.git` history එකත් ඇතුළත්. ZIP එක Extract කරලා GitHub එකේ **empty repository** එකක් හදන්න. ඊට පස්සේ project folder එකේ:

```bash
git remote add origin YOUR_EMPTY_REPOSITORY_URL
git push -u origin main
```

`YOUR_EMPTY_REPOSITORY_URL` වෙනුවට GitHub එක දෙන URL එක දාන්න. Access token හෝ password එක source code එකට ලියන්න එපා.

## වැදගත් සීමා

මේක VEXORA 0.1.0 working prototype එක. 12 advanced feature areas සඳහා මූලික implementation ඇතුළත් වුණත්, ඒවා සියල්ලම production-grade ලෙස අවසන් කරලා නැහැ. True AI model එකක්, AI image generation, PDF/CMYK print engine හෝ tested Linux AppImage එකක් මේ ZIP එකේ නැහැ. සම්පූර්ණ සීමා `docs/FEATURE_STATUS.md` තුළ තියෙනවා.

## Logo සහ About
- VEXORA logo එක application title bar එකේ සහ favicon එකේ භාවිතා වේ.
- Grafio logo එක සහ නිර්මාතෘ විස්තර `Help → About VEXORA Studio` තුළ ඇත.
- Version: v 1.0.0 (October 2026).
