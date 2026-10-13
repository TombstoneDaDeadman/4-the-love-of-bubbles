using System;
using System.IO;
using Bubbles.Core;
using Bubbles.Data;
using Bubbles.UI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;
namespace Bubbles.Editor
{
    public static class ProjectSetup
    {
        const string Root="Assets/_Project/";
        [MenuItem("Bubbles/Generate initial project (new project only)")]
        public static void Generate()
        {
            // Do not overwrite reviewed scenes or data on ordinary import.
            if(File.Exists(Root+"Scenes/SCN_HomeWorkshop.unity")) { Debug.Log("Bubbles: existing scene preserved.");return; }
            foreach(string d in new[]{"Scenes","Data","Art/Materials","Settings","Prefabs","Audio","Tests"})Directory.CreateDirectory(Root+d);
            AssetDatabase.Refresh();
            var catalog=ScriptableObject.CreateInstance<GameCatalog>();
            catalog.ingredients=new IngredientDefinition[7];
            string[] ids={"shea","oil","botanical","soap-base","scrub-base","jar","soap-wrap"};
            string[] names={"Shea Butter","Carrier Oil","Botanical Blend","Soap Base","Sugar Base","Jar","Soap Wrap"};
            int[] pack={12,12,12,16,12,24,24},cost={1200,600,1200,1200,600,1200,600};
            for(int i=0;i<7;i++)
            {
                var d=ScriptableObject.CreateInstance<IngredientDefinition>();d.id=ids[i];d.displayName=names[i];d.packSize=pack[i];d.packCostCents=cost[i];
                AssetDatabase.CreateAsset(d,Root+"Data/SO_Ingredient_"+ids[i]+".asset");catalog.ingredients[i]=d;
            }
            catalog.products=new ProductDefinition[3];catalog.recipes=new RecipeDefinition[3];
            string[] productIds={"body-butter","handmade-soap","body-scrub"};string[] productNames={"Body Butter","Handmade Soap","Body Scrub"};
            int[] prices={1200,850,1000},yields={6,8,6};float[] seconds={45,60,40};
            int[][] inputs={new[]{6,2,1,0,0,6,0},new[]{0,1,1,8,0,0,8},new[]{0,2,1,0,6,6,0}};
            for(int i=0;i<3;i++)
            {
                var p=ScriptableObject.CreateInstance<ProductDefinition>();p.id=productIds[i];p.displayName=productNames[i];p.priceCents=prices[i];p.fragrance=new[]{"Shea & warm vanilla","Botanical garden","Sugar & lavender"}[i];
                p.color=new[]{new Color(.85f,.55f,.38f),new Color(.43f,.63f,.54f),new Color(.64f,.56f,.74f)}[i];
                AssetDatabase.CreateAsset(p,Root+"Data/SO_Product_"+p.id+".asset");catalog.products[i]=p;
                var r=ScriptableObject.CreateInstance<RecipeDefinition>();r.id=p.id+"-classic";r.productIndex=i;r.yield=yields[i];r.seconds=seconds[i];r.ingredients=inputs[i];
                AssetDatabase.CreateAsset(r,Root+"Data/SO_Recipe_"+p.id+".asset");catalog.recipes[i]=r;
            }
            AssetDatabase.CreateAsset(catalog,Root+"Data/SO_GameCatalog.asset");
            var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,Root+"Settings/URP_Renderer.asset");
            var pipeline=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(pipeline,Root+"Settings/URP_Pipeline.asset");
            GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
            QualitySettings.shadowDistance=30;QualitySettings.shadows=UnityEngine.ShadowQuality.All;QualitySettings.antiAliasing=0;
            var panel=ScriptableObject.CreateInstance<PanelSettings>();panel.themeStyleSheet=AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(Root+"Resources/WorkshopTheme.tss");panel.scaleMode=PanelScaleMode.ScaleWithScreenSize;panel.referenceResolution=new Vector2Int(1600,900);panel.match=.5f;AssetDatabase.CreateAsset(panel,Root+"Settings/UI_Panel.asset");
            PlayerSettings.companyName="Majestic Games";PlayerSettings.productName="4 The Love Of Bubbles";
            PlayerSettings.defaultScreenWidth=1600;PlayerSettings.defaultScreenHeight=900;PlayerSettings.fullScreenMode=FullScreenMode.Windowed;
            PlayerSettings.runInBackground=true;PlayerSettings.colorSpace=ColorSpace.Linear;
            var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);
            settings.FindProperty("activeInputHandler").intValue=1;settings.ApplyModifiedPropertiesWithoutUndo();
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            WorkshopBuilder.Create(Material);
            AssetDatabase.SaveAssets();
            var game=new GameObject("Business Bootstrap");var document=game.AddComponent<UIDocument>();
            SetPanel(document,AssetDatabase.LoadAssetAtPath<PanelSettings>(Root+"Settings/UI_Panel.asset"));
            game.AddComponent<WorkshopUI>();game.AddComponent<GameBootstrap>().catalog=catalog;
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),Root+"Scenes/SCN_HomeWorkshop.unity");
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            new GameObject("Load Home Workshop").AddComponent<BootstrapScene>();
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),Root+"Scenes/SCN_Bootstrap.unity");
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(Root+"Scenes/SCN_Bootstrap.unity",true),new EditorBuildSettingsScene(Root+"Scenes/SCN_HomeWorkshop.unity",true)};
            EditorSceneManager.OpenScene(Root+"Scenes/SCN_HomeWorkshop.unity");AssetDatabase.SaveAssets();Debug.Log("BUBBLES_SETUP_OK");
        }
        static Material Material(string name,Color color)
        {
            string path=Root+"Art/Materials/MAT_"+name.Replace(" ","_")+".mat";
            var material=AssetDatabase.LoadAssetAtPath<Material>(path);if(material!=null)return material;
            material=new Material(Shader.Find("Universal Render Pipeline/Lit")){name=name};material.SetColor("_BaseColor",color);material.SetFloat("_Smoothness",.2f);
            if(name=="Kenney Palette")
            {
                string[] textures=AssetDatabase.FindAssets("t:Texture2D",new[]{Root+"ThirdParty/Kenney"});
                if(textures.Length>0)material.SetTexture("_BaseMap",AssetDatabase.LoadAssetAtPath<Texture2D>(AssetDatabase.GUIDToAssetPath(textures[0])));
            }
            AssetDatabase.CreateAsset(material,path);return material;
        }
        public static void BuildWindows()
        {
            Directory.CreateDirectory("Builds/Windows");
            var report=BuildPipeline.BuildPlayer(EditorBuildSettings.scenes,"Builds/Windows/4 The Love Of Bubbles.exe",BuildTarget.StandaloneWindows64,BuildOptions.None);
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Windows build failed: "+report.summary.result);
            Debug.Log("BUBBLES_BUILD_OK");
        }
        public static void GenerateAndValidate() { Generate(); Validation.RunAll(); }
        static void SetPanel(UIDocument document,PanelSettings panel)
        {
            var serialized=new SerializedObject(document);serialized.FindProperty("m_PanelSettings").objectReferenceValue=panel;
            serialized.ApplyModifiedPropertiesWithoutUndo();EditorUtility.SetDirty(document);
        }
        [MenuItem("Bubbles/Repair initial workshop presentation")]
        public static void RepairPresentation()
        {
            if(EditorApplication.isPlaying)throw new Exception("Stop Play before editing the scene.");
            EditorSceneManager.OpenScene(Root+"Scenes/SCN_HomeWorkshop.unity");
            SetPanel(UnityEngine.Object.FindAnyObjectByType<UIDocument>(),AssetDatabase.LoadAssetAtPath<PanelSettings>(Root+"Settings/UI_Panel.asset"));
            foreach(var text in UnityEngine.Object.FindObjectsByType<TextMesh>())
            {
                text.transform.localScale=Vector3.one*.15f;
                if(text.text.StartsWith("4 THE LOVE"))text.transform.rotation=Quaternion.identity;
            }
            EditorSceneManager.MarkSceneDirty(UnityEngine.SceneManagement.SceneManager.GetActiveScene());
            EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene());
            Debug.Log("BUBBLES_PRESENTATION_REPAIRED");
        }
    }
}
