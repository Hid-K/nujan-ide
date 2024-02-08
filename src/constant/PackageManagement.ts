interface NodePackage
{
    name: String;
    text: String;
    path: String;
}

class PackageManager
{
    private supportedPackages: Map<String, NodePackage> = new Map<String, NodePackage>();

    constructor()
    {
        (async () =>
        {
            [
                // {
                //   name: "ton-crypto@3.2.0",
                //   text: 
                // },
                {
                    name: "@ton/core@0.54.0",
                    text: await fetch('/assets/ton/types/ton-core.d.ts').then( response => response.text() ),
                    path: 'file:///node_modules/@types/ton-core/index.d.ts'
                },
                {
                    name: "@ton-community/sandbox@3.2.0",
                    text: await fetch('/assets/ton/types/ton-sandbox.d.ts').then( response => response.text() ),
                    path: 'file:///node_modules/@types/@ton-community/sandbox/index.d.ts'
                }
            ].map( entry => this.supportedPackages.set( entry.name, entry )  )
        })()
    }

    public async getPackage( packageName: string ): Promise<NodePackage>
    {
        const pkg: NodePackage | undefined = this.supportedPackages.get( packageName );
        if ( pkg == undefined )
        {
            throw new Error( `Package ${packageName} is not supported.` );
        }

        return pkg;
    }
}

const SupportedPackagesManager: PackageManager = new PackageManager();