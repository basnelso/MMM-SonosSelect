# MMM-SonosSelect

This an extension for the [MagicMirror²](https://magicmirror.builders/).

This Module gives buttons for each of the rooms in your Sonos setup and allows you to select which rooms are playing music or grouped together.

### Screen shots

Module with symbols only in row mode:

![Modulebar Row Symbols](https://github.com/Snille/MMM-Modulebar/blob/master/.github/ModuleBar-01.png)

Module with symbols only in column mode:

![Modulebar Column Symbols](https://github.com/Snille/MMM-Modulebar/blob/master/.github/ModuleBar-02.png)

Module with symbols and text in column mode:

![Modulebar Column Symbols Text](https://github.com/Snille/MMM-Modulebar/blob/master/.github/ModuleBar-03.png)

Module with symbols and text in row mode:

![Modulebar Row Symbols Text](https://github.com/Snille/MMM-Modulebar/blob/master/.github/ModuleBar-04.png)

This is my own mirrors view (Bottom Bar) using some addition in the custom.css [see below](#custom-css)

![Modulebar Custom CSS](https://github.com/Snille/MMM-Modulebar/blob/master/.github/ModuleBar-05.png)

### Installation

In your terminal, go to your MagicMirror's Module folder:
````
cd ~/MagicMirror/modules
````

Clone this repository:
````
git clone https://github.com/basnelso/MMM-SonosSelect
````

### Using the module

To use this module, add it to the modules array in the `config/config.js` file:
````javascript
modules: [
    {
        module: "MMM-SonosSelect",
        position: "bottom_bar", // This can be any of the regions.
        config: {
            // See 'Configuration options' for more information.
        }
    }
]
````

### Configuration options

The following properties can be configured:

| Option             | Default | Description
| ------------------ | ------- | -----------
| `showBorder`       | `true` | Determines if the border around the buttons should be shown. <br><br> **Possible values:** `true` or `false`
| `minWidth`         | `0px` | The minimum width for all the buttons. <br><br> **Possible values:** `css length`
| `minHeight`        | `0px` | The minimum height for all the buttons. <br><br> **Possible values:** `css length`
| `direction`        | `row` | The direction of the menu. <br><br> **Possible values:** `row`, `column`, `row-reverse` or `column-reverse`
| `buttons`          | Clock example button | All the different buttons in the menu. <br><br> **Possible values:** a button configuration, see [Configuring Buttons](#configuring-buttons)

### Configuring Buttons

Buttons have to be placed in `buttons` in the `config`. A button contains a uniqe number as a key and a set of options in the object (`{}`).

Each button starts with it's own uniqe number (ex. "1"), then add the options needed.

| Option   | Description
| -------- | -----------
| `room`   | The string of the room name in sonos. <br><br> **Possible values:** `string`
| `symbol` | A symbol to display in the button. <br><br> **Note:** if no value is set no symbol will be displayed. <br> **Possible values:** See [Font Awesome](http://fontawesome.io/icons) website
| `size`   | The size of the symbol. <br><br> **Note:** will only have effect on a symbol. <br> **Default value:** `1` <br> **Possible values:** `1`, `2`, `3`, `4` or `5`
| `width`  | The width of the image. <br><br> **Note:** will only have effect on an image. <br> **Possible values:** `number`
| `height` | The height of the image. <br><br> **Note:** will only have effect on an image. <br> **Possible values:** `number`


An example:

````javascript
  buttons: {
    "1": {
      room: "Living Room", // Needs to match the room name in your sonos app
      symbol: "couch"
    },
    "2": {
      room: "Kitchen",
      symbol: "utensils"
    },
    "3": {
      room: "Bathroom",
      symbol: "toilet"
    },
  }
````

### Notes
* **Important:** unfortunatly positioning this module as fullscreen will result in the menu floating top left. I currently do not know how to fix this but will look into it. If you know how don't hesitate to either write me or send me a pull request!
* If the image is an local path and it does not show. Try different ways to write the local path. If this still does not work then try putting the image in a folder in your MagicMirror folder and use as local path `foldername/imagename`.
* If only heigh or width is set for an image the other size will scale to maintain it the image it's original aspect ratio.
* Module name is case sensitive.
* If both the `text` and `symbol` aren't set for a button then the button won't contain anything, but still show the border.
* The symbols are all form the [Font Awesome](http://fontawesome.io/icons) website.
* The text may contain HTML tags and will be displayed as HTML.