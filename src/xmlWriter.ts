import * as fs from 'fs';

const DEFAULT_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

export class XmlWriter {
    _OpenTags:string[] = [];
    _Content = "";
    bMinimized = false;
    Filename = "";
    _bCurrentlyEmptyTag = false;

    constructor (Filename:string) {
        this.Filename = Filename;
        this._Content = DEFAULT_HEADER + "\n";
    }

    OpenTag(TagName: string) {
        this._OpenTags.push(TagName);
        if (!this.bMinimized)
            if (this._bCurrentlyEmptyTag)
                this._Content += "\n";
            this._Content += Array(this._OpenTags.length).join('\t');
        this._Content += `<${TagName}>`;
        this._bCurrentlyEmptyTag = true;
    }

    WriteContent(Text:string) {
        this._Content += Text;
        this._bCurrentlyEmptyTag = false;
    }

    CloseTag() {
        const LastTag = this._OpenTags[this._OpenTags.length - 1];
        this._OpenTags.pop();
        this._Content += `</${LastTag}>`;
        if (!this.bMinimized)
            this._Content += "\n";
        this._bCurrentlyEmptyTag = false;
    }

    Minimize() {
        this._Content = this._Content.replace(/>\s*</g, "><");
    }

    WriteFile() {
        fs.writeFileSync(this.Filename, this._Content, { "encoding": "utf8" });
    }

}