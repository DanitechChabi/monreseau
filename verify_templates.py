import os, django, re, sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from django.template.loader import get_template
from django.urls import get_resolver

from django.conf import settings

# Collect all project templates
template_dirs = []
for app in ['accounts','core','friends','groups','messaging','notifications','pages','posts']:
    template_dirs.append(os.path.join(settings.BASE_DIR, app, 'templates'))
template_dirs.append(os.path.join(settings.BASE_DIR, 'templates'))

all_templates = []  # (template_name, abs_path)
for d in template_dirs:
    for root, dirs, files in os.walk(d):
        for f in files:
            if f.endswith('.html'):
                abs_path = os.path.join(root, f)
                tpl_dir = os.path.join(settings.BASE_DIR, 'templates')
                if abs_path.startswith(tpl_dir):
                    name = os.path.relpath(abs_path, tpl_dir)
                else:
                    # app templates: find templates/ subdir
                    idx = abs_path.find(os.sep + 'templates' + os.sep)
                    name = abs_path[idx + len(os.sep + 'templates' + os.sep):].replace(os.sep, '/')
                all_templates.append((name, abs_path))

print("=== Compiling all templates ===")
compile_errors = []
for name, abs_path in all_templates:
    try:
        get_template(name)
    except Exception as e:
        compile_errors.append((name, str(e)))
print("Total templates: %d" % len(all_templates))
for rel, err in compile_errors:
    print("COMPILE ERROR %s: %s" % (rel, err))

resolver = get_resolver()
all_url_names = set()
def walk_urls(patterns):
    for pat in patterns:
        if hasattr(pat, 'url_patterns'):
            walk_urls(pat.url_patterns)
        elif pat.name:
            all_url_names.add(pat.name)
walk_urls(resolver.url_patterns)

print("\n=== URL names defined ===")
print(sorted(all_url_names))

url_re = re.compile(r"\{%\s*url\s+['\"](\w+)['\"]")
inc_re = re.compile(r"\{%\s*include\s+['\"]([^'\"]+)['\"]")
print("\n=== Missing URL names / Includes ===")
for name, abs_path in all_templates:
    with open(abs_path, encoding='utf-8') as fh:
        content = fh.read()
    for m in url_re.finditer(content):
        uname = m.group(1)
        if uname not in all_url_names:
            print("MISSING URL NAME %s: %s" % (name, uname))
    for m in inc_re.finditer(content):
        inc = m.group(1)
        try:
            get_template(inc)
        except Exception as e:
            print("MISSING INCLUDE %s: %s -> %s" % (name, inc, e))
print("Done.")
