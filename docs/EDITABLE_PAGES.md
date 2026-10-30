# Editing site pages (Batch 16, migration 0018)

**Admin -> Pages** lists the home page and eight pages: Terms, Privacy, Cookies, Acceptable Use, Data Deletion, Help, Contact, About.

- Until you save a page, the site shows its built-in text. Saving replaces it. **Use the built-in text** goes back. The last 10 saved versions are kept and can be restored.
- Page text is simple Markdown (the editor shows the few rules). No HTML is allowed; links may only be https, http, mailto, or paths on this site.
- Placeholders such as `{{operator}}`, `{{contact_email}}`, `{{deletion_days}}`, `{{governing_law}}` fill in automatically from the site settings. On Data Deletion, a line containing only `{{deletion_check_form}}` shows the confirmation code box.
- The home page is edited as separate fields (top of page, steps, features, questions, bottom banner). Lists use `Title | Text` per line.
- Everything must be English. The editor refuses Bengali characters.
- Policy pages are legal text. Get a qualified person to review any change to what they promise.
- Page titles and descriptions in search results are still fixed in code; Batch 18 (SEO) makes them editable.
