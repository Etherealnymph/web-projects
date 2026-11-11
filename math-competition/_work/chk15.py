import io,re,sys
sys.path.insert(0,"_work")
import importlib.util
spec=importlib.util.spec_from_file_location("bw","_work/build_web.py")
bw=importlib.util.module_from_spec(spec); spec.loader.exec_module(bw)
import inspect
print(inspect.getsource(bw.md_to_html))
