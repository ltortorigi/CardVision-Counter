# CardVision Counter

CardVision Counter is a Windows/macOS desktop blackjack assistant with screen recognition, Hi-Lo counting, player/dealer tracking, selectable player seat, dealer hand history, a pre-hand bet signal, and count-adjusted move recommendations.

## Which file do I click?

### Windows

**First time:** open the `Windows` folder and double-click:

`1 - SETUP CARDVISION.bat`

The setup checks for Node.js, installs CardVision's packages, and creates a **CardVision Counter** shortcut on your Desktop.

After that, always use the **black/gold poker-chip CardVision Counter icon on your Desktop**.

If you do not see that icon, run `1 - SETUP CARDVISION.bat` again.

Backup launcher: `Windows\2 - START CARDVISION.bat`

### Mac

**First time:** open the `Mac` folder and double-click:

`1 - SETUP CARDVISION.command`

After setup, always use:

`CardVision Counter.app`

It has the **black/silver poker-chip icon**.

If macOS blocks it the first time, right-click `CardVision Counter.app`, choose **Open**, then choose **Open** again.

Backup launcher: `Mac/2 - START CARDVISION.command`

## Required software

CardVision's source launcher requires **Node.js 20 or newer**. npm is included with Node.js.

Official Node.js download:

https://nodejs.org/en/download

Choose the current **LTS** installer for your operating system.

You do **not** need Python, Java, Visual Studio, Xcode, or a database to run the normal source version.

## First startup

The first startup/setup runs:

`npm install`

That downloads Electron, Tesseract.js, and the other packages CardVision needs. This can take a few minutes depending on internet speed.

Later launches use the already-installed packages.

## Folder layout

```text
CardVision_Counter_v12/
│
├── START HERE.txt
├── README.md
│
├── Windows/
│   ├── 1 - SETUP CARDVISION.bat
│   ├── 2 - START CARDVISION.bat
│   └── Create CardVision Shortcut.ps1
│
├── Mac/
│   ├── CardVision Counter.app
│   ├── 1 - SETUP CARDVISION.command
│   └── 2 - START CARDVISION.command
│
├── App/
│   ├── package.json
│   ├── main.js
│   ├── preload.js
│   ├── renderer.js
│   ├── index.html
│   ├── styles.css
│   └── assets/
│
├── Developer/
│   ├── BUILD WINDOWS PORTABLE APP.bat
│   ├── BUILD MAC APP.command
│   └── tests/
│
└── Build Output/
```

Normal users only need the **Windows** or **Mac** folder. The `App` and `Developer` folders should be left alone.

## Icons

- Windows: black/gold `$100` CardVision poker chip.
- Mac: black/silver speckled `$100` CardVision poker chip.

The Windows setup creates the icon shortcut using the correct absolute path for the computer where the ZIP was extracted.

The Mac `.app` contains its icon inside the application bundle.

## Building a version to send to someone without Node.js

A packaged build is easier for recipients because they do not need Node.js.

### Build Windows portable app

On a Windows computer, run:

`Developer\BUILD WINDOWS PORTABLE APP.bat`

The output appears in `Build Output`.

### Build Mac app/DMG

On a Mac, run:

`Developer/BUILD MAC APP.command`

The output appears in `Build Output`.

## Troubleshooting

### "Node.js is not installed"

Install the LTS version from:

https://nodejs.org/en/download

Then close and reopen the setup file.

### Windows shortcut has the wrong icon

Run:

`Windows\1 - SETUP CARDVISION.bat`

again. It recreates the shortcut using the icon stored in `App\assets\windows_chip.ico`.

### Mac says the app cannot be opened

Right-click `CardVision Counter.app` and choose **Open**. If prompted, choose **Open** again.

### npm warnings

Deprecation warnings from nested packages do not automatically mean CardVision is broken. To check the installed dependency tree, open a terminal in the `App` folder and run:

`npm audit`

## Important

Keep the entire CardVision folder together. Do not move only the shortcut, `.bat`, `.command`, or `.app` files away from the rest of the project unless you are using a packaged build from `Build Output`.
