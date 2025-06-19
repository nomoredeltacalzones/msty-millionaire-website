import sys, requests, re, urllib.parse, pathlib
root = "https://mystymillionare.com/"
seen, bad = set(), {}

def crawl(url):
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
    except Exception as e:
        bad[url] = str(e)
        return
    for link in re.findall(r'href=["\'](.*?)["\']', r.text):
        link = urllib.parse.urljoin(url, link)
        if link.startswith(root) and link not in seen:
            seen.add(link); crawl(link)

crawl(root)
print("\nBroken links:")
for url, err in bad.items():
    print(f"{url}  --> {err}")
if bad: sys.exit(1)
