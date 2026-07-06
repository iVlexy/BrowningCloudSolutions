import { Pipe, PipeTransform } from '@angular/core'
import { marked } from 'marked'

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return ''
    // Bind the result via [innerHTML] so Angular's built-in sanitizer
    // strips unsafe markup (scripts, event handlers) before rendering.
    return marked.parse(value, { async: false, gfm: true, breaks: true }) as string
  }
}
