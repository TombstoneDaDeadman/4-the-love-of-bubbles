using System;
using UnityEngine;
namespace Bubbles.Core
{
    // Prototype dressing. Kenney furniture meshes are used alongside simple procedural product stand-ins.
    public static class WorkshopBuilder
    {
        static Transform room;
        static Func<string, Color, Material> makeMaterial;
        static Material wood, cream, sage, peach, metal, leaf, cardboard, dark;
        public static void Create(Func<string, Color, Material> materialFactory)
        {
            makeMaterial = materialFactory;
            room = new GameObject("Home Workshop").transform;
            room.gameObject.AddComponent<WorkshopVisuals>();
            wood = M("Honey Wood", new(.55f,.36f,.22f)); cream = M("Cream", new(.93f,.89f,.79f));
            sage = M("Sage", new(.43f,.63f,.54f)); peach = M("Terracotta", new(.85f,.55f,.38f));
            metal = M("Brushed Steel", new(.58f,.63f,.64f)); leaf = M("Botanical", new(.19f,.38f,.23f));
            cardboard = M("Cardboard", new(.65f,.47f,.28f)); dark = M("Ink", new(.12f,.2f,.2f));
            Cube("Workshop foundation", new(0,-.23f,0), new(8.6f,.35f,7.6f), wood);
            for (int x=0;x<8;x++) for(int z=0;z<7;z++)
                Cube("Oak floor", new(x-3.5f,-.025f,z-3),new(.985f,.08f,.985f), (x+z)%2==0?cream:M("Pale Oak",new(.84f,.76f,.61f)));
            var back=Cube("Cutaway back wall",new(0,1.4f,3.55f),new(8.5f,2.8f,.15f),cream);back.tag="Finish";
            var side=Cube("Cutaway side wall",new(-4.15f,1.4f,0),new(.15f,2.8f,7.2f),sage);side.tag="Finish";
            Cube("Back skirting",new(0,.12f,3.4f),new(8.3f,.2f,.12f),wood);
            // Window + handmade brand sign on far wall.
            Cube("Window frame",new(-2.3f,1.75f,3.42f),new(2,1.4f,.08f),wood);
            Cube("Daylight pane",new(-2.3f,1.75f,3.35f),new(1.85f,1.25f,.04f),M("Window Sky",new(.61f,.82f,.85f)));
            Cube("Window mullion",new(-2.3f,1.75f,3.3f),new(.06f,1.3f,.04f),cream);
            Cube("Brand sign",new(.75f,2.03f,3.36f),new(2.8f,.9f,.08f),sage);
            Sign("4 THE LOVE\nOF BUBBLES",new(.75f,2.1f,3.29f),.12f,Color.white,Quaternion.identity);
            // Workstations: visible colliders map to contextual UI.
            Table("Mixing station",new(-1.65f,0,.1f),new(2.3f,.9f,1.05f),"Production");
            Cube("Mixer base",new(-1.9f,1.02f,.15f),new(.7f,.23f,.58f),sage);
            Cylinder("Mixing bowl",new(-1.9f,1.22f,.15f),new(.48f,.16f,.48f),metal);
            Cube("Mixer arm",new(-2.15f,1.35f,.15f),new(.12f,.6f,.16f),sage);
            Cube("Mixer head",new(-1.93f,1.58f,.15f),new(.52f,.18f,.24f),sage);
            Cube("Mixer Paddle",new(-1.9f,1.35f,.15f),new(.35f,.05f,.1f),wood);
            Cube("Upgraded Mixer",new(-1.7f,1.59f,.15f),new(.1f,.1f,.26f),peach);
            Jar("Fresh butter",new(-1.12f,1.02f,-.05f),.24f,peach);
            Jar("Botanical oil",new(-.9f,1.08f,.4f),.15f,sage);
            Sign("MIX & MAKE",new(-1.65f,.95f,-.48f),.09f,dark.color,Quaternion.Euler(60,0,0));
            Table("Packing station",new(1.55f,0,-1.65f),new(2.5f,.9f,1.15f),"Orders");
            Cube("Shipping box",new(1.6f,1.14f,-1.7f),new(.6f,.45f,.5f),cardboard);
            Cube("Parcel tape",new(1.6f,1.372f,-1.7f),new(.08f,.015f,.51f),cream);
            Prop("laptop",new(.75f,.95f,-1.5f),.45f,180);
            Sign("PACKED WITH LOVE",new(1.6f,.94f,-2.26f),.08f,dark.color,Quaternion.Euler(60,0,0));
            // Supply shelf along left wall.
            Shelf("Ingredient shelf",new(-3.4f,0,1.7f),new(1.25f,1.95f,.65f),"Supplies");
            for(int i=0;i<8;i++) Jar("Supply jar",new(-3.85f+(i%4)*.3f,.5f+(i/4)*.6f,1.7f),.2f,i%2==0?sage:peach);
            // Product display with state-driven units.
            Shelf("Finished goods",new(1.5f,0,2.65f),new(2.3f,1.8f,.65f),"Orders");
            Material[] colors={peach,sage,M("Lavender",new(.64f,.56f,.74f))};
            for(int p=0;p<3;p++)for(int i=0;i<12;i++)
            {
                var g = Jar("Product "+p+"-"+i,new(.52f+(i%6)*.35f,.4f+p*.47f,2.5f+(i/6)*.24f),.18f,colors[p]);
                g.SetActive(false);
            }
            Prop("pottedPlant",new(3.35f,0,2.5f),1.05f,0);
            Prop("chair",new(.35f,0,-2.8f),1,180);
            Prop("cardboardBoxOpen",new(3.25f,0,-2.3f),.55f,25);
            Prop("kitchenCabinet",new(-3.4f,0,-2.6f),1.1f,90);
            Prop("plantSmall1",new(-3.4f,1,-2.6f),.3f,0);
            // Founder representation with restrained proportions; bespoke character art is deferred.
            var founder=new GameObject("Founder placeholder"); founder.transform.SetParent(room);founder.transform.position=new(-.35f,0,-.95f);
            Material skin=M("Founder Skin",new(.42f,.24f,.15f));
            Part(founder.transform,"Left shoe",new(-.12f,.09f,0),new(.17f,.16f,.28f),dark);
            Part(founder.transform,"Right shoe",new(.12f,.09f,0),new(.17f,.16f,.28f),dark);
            Part(founder.transform,"Left leg",new(-.12f,.45f,0),new(.16f,.64f,.16f),dark);
            Part(founder.transform,"Right leg",new(.12f,.45f,0),new(.16f,.64f,.16f),dark);
            Part(founder.transform,"Torso",new(0,1.08f,0),new(.46f,.6f,.24f),cream);
            Part(founder.transform,"Apron",new(0,.98f,-.135f),new(.37f,.56f,.04f),sage);
            Part(founder.transform,"Left arm",new(-.29f,1.07f,0),new(.12f,.52f,.14f),skin);
            Part(founder.transform,"Right arm",new(.29f,1.07f,0),new(.12f,.52f,.14f),skin);
            var head=GameObject.CreatePrimitive(PrimitiveType.Sphere);head.name="Founder head";head.transform.SetParent(founder.transform);head.transform.localPosition=new(0,1.52f,0);head.transform.localScale=new(.23f,.28f,.23f);head.GetComponent<Renderer>().sharedMaterial=skin;
            Part(founder.transform,"Hair",new(0,1.65f,.02f),new(.24f,.12f,.23f),dark);
            var cam=new GameObject("Management Camera");cam.tag="MainCamera";var camera=cam.AddComponent<Camera>();camera.fieldOfView=43;camera.backgroundColor=new(.7f,.79f,.76f);camera.clearFlags=CameraClearFlags.SolidColor;cam.AddComponent<AudioListener>();cam.AddComponent<ManagementCamera>();
            cam.transform.position=new(7.5f,8,-8.3f);cam.transform.LookAt(new Vector3(0,.55f,0));
            var sun=new GameObject("Warm daylight");var light=sun.AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.4f;light.color=new(1,.93f,.81f);light.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(50,-25,0);
            RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Flat;RenderSettings.ambientLight=new(.73f,.78f,.74f);
        }
        static Material M(string name,Color c)=>makeMaterial(name,c);
        static GameObject Cube(string name,Vector3 pos,Vector3 size,Material mat)
        {
            var g=GameObject.CreatePrimitive(PrimitiveType.Cube);g.name=name;g.transform.SetParent(room);g.transform.position=pos;g.transform.localScale=size;g.GetComponent<Renderer>().sharedMaterial=mat;return g;
        }
        static void Part(Transform parent,string name,Vector3 pos,Vector3 size,Material mat)
        {var g=Cube(name,Vector3.zero,size,mat);g.transform.SetParent(parent);g.transform.localPosition=pos;}
        static GameObject Cylinder(string name,Vector3 pos,Vector3 size,Material mat)
        {var g=GameObject.CreatePrimitive(PrimitiveType.Cylinder);g.name=name;g.transform.SetParent(room);g.transform.position=pos;g.transform.localScale=size;g.GetComponent<Renderer>().sharedMaterial=mat;return g;}
        static GameObject Jar(string name,Vector3 pos,float width,Material mat)
        {
            var g=Cylinder(name,pos,new(width,width*.45f,width),mat);
            var cap=Cylinder("Jar lid",pos+Vector3.up*width*.5f,new(width*1.05f,width*.08f,width*1.05f),cream);cap.transform.SetParent(g.transform,true);
            return g;
        }
        static void Table(string name,Vector3 pos,Vector3 size,string panel)
        {
            var top=Cube(name,pos+Vector3.up*size.y,new(size.x,.12f,size.z),wood);top.AddComponent<WorkshopStation>().panel=panel;
            for(int x=-1;x<=1;x+=2)for(int z=-1;z<=1;z+=2)Cube("Table leg",pos+new Vector3(x*(size.x/2-.12f),size.y/2,z*(size.z/2-.12f)),new(.12f,size.y,.12f),cream);
        }
        static void Shelf(string name,Vector3 pos,Vector3 size,string panel)
        {
            var back=Cube(name,pos+new Vector3(0,size.y/2,size.z/2),new(size.x,size.y,.1f),wood);back.AddComponent<WorkshopStation>().panel=panel;
            for(int i=0;i<4;i++)Cube("Shelf board",pos+new Vector3(0,.15f+i*(size.y-.2f)/3,0),new(size.x,.07f,size.z),wood);
            for(int i=-1;i<=1;i+=2)Cube("Shelf side",pos+new Vector3(i*size.x/2,size.y/2,0),new(.07f,size.y,size.z),wood);
        }
        static void Sign(string text,Vector3 pos,float size,Color color,Quaternion rotation)
        {
            var g=new GameObject("Workshop label");g.transform.SetParent(room);g.transform.position=pos;g.transform.rotation=rotation;
            var tm=g.AddComponent<TextMesh>();tm.text=text;tm.fontSize=64;tm.characterSize=size;tm.anchor=TextAnchor.MiddleCenter;tm.alignment=TextAlignment.Center;tm.color=color;g.transform.localScale=Vector3.one*.15f;
        }
        static void Prop(string name,Vector3 pos,float desiredHeight,float yaw)
        {
            var source=Resources.Load<GameObject>("Furniture/"+name);if(source==null)throw new InvalidOperationException("Missing Kenney prop: "+name);
            var g=UnityEngine.Object.Instantiate(source,room);g.name="Kenney "+name;
            var renders=g.GetComponentsInChildren<Renderer>();Bounds bounds=new Bounds();bool first=true;
            foreach(var r in renders){if(first){bounds=r.bounds;first=false;}else bounds.Encapsulate(r.bounds);}
            float scale=desiredHeight/Mathf.Max(.01f,bounds.size.y);g.transform.localScale*=scale;g.transform.rotation=Quaternion.Euler(0,yaw,0);
            bounds=renders[0].bounds;foreach(var r in renders)bounds.Encapsulate(r.bounds);g.transform.position+=pos-new Vector3(bounds.center.x,bounds.min.y,bounds.center.z);
            // Retain the kit's per-surface colors with URP-compatible materials.
            foreach(var r in renders)
            {
                var materials=r.sharedMaterials;
                for(int i=0;i<materials.Length;i++)
                {
                    var sourceMaterial=materials[i];
                    Color color=sourceMaterial!=null&&sourceMaterial.HasProperty("_Color")?sourceMaterial.GetColor("_Color"):Color.white;
                    materials[i]=makeMaterial("Kenney_"+(sourceMaterial!=null?sourceMaterial.name:"Default"),color);
                }
                r.sharedMaterials=materials;
            }
        }
    }
}
