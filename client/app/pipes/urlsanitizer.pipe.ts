import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

/**
 * Url Sanitizer pipe.
 *
 * This trusts URLs that exist in a safe list defined in our environments.ts file.
 * Any other URLs will NOT be trusted, thus will not be loaded.
 */
@Pipe({ name: 'urlSanitizer', standalone: true })
export class UrlSanitizer implements PipeTransform {

    constructor(private sanitizer: DomSanitizer) { }

    public transform(url: string): SafeUrl {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
}

@Pipe({ name: 'htmlSanitizer', standalone: true })
export class HTMLSanitizer implements PipeTransform {

    constructor(private sanitizer: DomSanitizer) { }

    public transform(url: string): SafeUrl {
        return this.sanitizer.bypassSecurityTrustHtml(url);
    }
}
