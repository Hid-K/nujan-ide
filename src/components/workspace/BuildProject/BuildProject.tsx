import { useContractAction } from '@/hooks/contract.hooks';
import { useWorkspaceActions } from '@/hooks/workspace.hooks';
import { ABI, Tree } from '@/interfaces/workspace.interface';
import { extractCompilerDiretive, parseGetters } from '@/utility/getterParser';
import {
  CompileResult,
  SuccessResult,
  compileFunc,
} from '@ton-community/func-js';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Button, Form, Select, message } from 'antd';
import Link from 'next/link';
import { FC, useEffect, useRef, useState } from 'react';
import { Cell } from 'ton-core';
import ContractInteraction from '../ContractInteraction';
import s from './BuildProject.module.scss';

interface Props {
  projectId: string;
  onCodeCompile: (codeBOC: string) => void;
  onABIGenerated: (abi: ABI[]) => void;
}
const BuildProject: FC<Props> = ({
  projectId,
  onCodeCompile,
  onABIGenerated,
}) => {
  const [isLoading, setIsLoading] = useState('');
  const [funcStdLib, setFuncStdLib] = useState('');
  const [buildOutput, setBuildoutput] = useState<{
    contractBOC: string | null;
    dataCell: Cell | null;
  } | null>(null);
  const [abi, setABI] = useState<ABI[]>([]);
  const cellBuilderRef = useRef<HTMLIFrameElement>(null);
  const [tonConnector] = useTonConnectUI();

  const { Option } = Select;

  const {
    projectFiles,
    getFileByPath,
    getFileContent,
    updateProjectById,
    project,
  } = useWorkspaceActions();
  const { deployContract } = useContractAction();

  const activeProject = project(projectId);

  const onFormFinish = async ({ fileId }: { fileId: Tree['id'] }) => {
    const file = getProjectFiles().find((f) => f.id === fileId);
    setBuildoutput(null);
    if (!file?.id) {
      message.error('File not found');
      return;
    }
    setIsLoading('build');

    try {
      let stdLib: any = funcStdLib;

      if (stdLib == '') {
        stdLib = await fetch('/assets/ton/stdlib.fc');
        stdLib = await stdLib.text();
        setFuncStdLib(stdLib);
      }

      const fileList: any = {};

      let filesToProcess = [file?.path];

      while (filesToProcess.length !== 0) {
        const fileToProcess = filesToProcess.pop();
        const file = await getFileByPath(fileToProcess, projectId);
        if (file?.content) {
          fileList[file.id] = file;
        }
        if (!file?.content) {
          continue;
        }
        let compileDirectives = await extractCompilerDiretive(file.content);
        if (compileDirectives.length === 0) {
          continue;
        }
        filesToProcess.push(...compileDirectives);
      }
      const filesCollection: Tree[] = Object.values(fileList);
      let buildResult: CompileResult = await compileFunc({
        targets: ['stdlib.fc', file?.name],
        sources: (path) => {
          if (path === 'stdlib.fc') {
            return stdLib.toString();
          }
          const file = filesCollection.find((f: Tree) => f.path === path);
          if (file?.content) {
            fileList[file.id] = file;
          }
          return file?.content;
        },
      });

      generateABI(fileList);

      if (buildResult.status === 'error') {
        message.error(buildResult.message);
        return;
      }

      setBuildoutput((t: any) => {
        return {
          ...t,
          contractBOC: (buildResult as SuccessResult).codeBoc,
        };
      });
      onCodeCompile(buildResult.codeBoc);
      message.success('Build successfull');
      createStateInitCell();
    } catch (error) {
      console.log('error', error);
      message.error('Something went wrong');
    } finally {
      setIsLoading('');
    }
  };

  const generateABI = async (fileList: any) => {
    const unresolvedPromises = Object.values(fileList).map(
      async (file: any) => {
        return await parseGetters(file.content);
      }
    );
    const results = await Promise.all(unresolvedPromises);
    setABI(results[0]);
    onABIGenerated(results[0]);
  };

  const deploy = async () => {
    if (!buildOutput?.contractBOC || !buildOutput?.dataCell) {
      return;
    }

    try {
      setIsLoading('deploy');
      const _contractAddress = await deployContract(
        buildOutput?.contractBOC,
        buildOutput?.dataCell as any
      );
      if (!_contractAddress) {
        return;
      }

      updateProjectById(
        {
          contractAddress: _contractAddress,
        },
        projectId
      );
    } catch (error: any) {
      console.log(error);
      // message.error(error.response?.data?.message);
    } finally {
      setIsLoading('');
    }
  };

  const createStateInitCell = async () => {
    if (!cellBuilderRef.current?.contentWindow) return;
    const stateInitData = await getFileByPath('stateInit.cell.js', projectId);
    if (stateInitData && !stateInitData.content) {
      message.error('State init data is missing in file stateInit.cell.js');
      return;
    }
    if (!stateInitData?.content?.includes('cell')) {
      message.error('cell variable is missing in file stateInit.cell.js');
      return;
    }
    cellBuilderRef.current.contentWindow.postMessage(
      {
        name: 'nujan-ton-ide',
        type: 'state-init-data',
        code: stateInitData?.content,
      },
      '*'
    );
  };

  const getProjectFiles = () => {
    const _projectFiles = projectFiles(projectId);
    let files: Tree[] = [];
    if (!_projectFiles) {
      return [];
    }

    files = _projectFiles.filter(
      (file) =>
        !file.parent && file.type !== 'directory' && file.name.includes('.fc')
    );

    return files;
  };

  useEffect(() => {
    const handler = (
      event: MessageEvent<{ name: string; type: string; data: any }>
    ) => {
      if (
        !event.data ||
        typeof event.data !== 'object' ||
        event.data?.type !== 'state-init-data' ||
        event.data?.name !== 'nujan-ton-ide'
      ) {
        return;
      }

      setBuildoutput((t: any) => {
        return {
          ...t,
          dataCell: event.data.data,
        };
      });
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  return (
    <div className={s.root}>
      <h3 className={s.heading}>Compile & Deploy</h3>
      <iframe
        className={s.cellBuilderRef}
        ref={cellBuilderRef}
        src="/html/tonweb.html"
      />
      <Form
        className={s.form}
        layout="vertical"
        onFinish={onFormFinish}
        autoComplete="off"
      >
        <Form.Item
          label="Select file to build"
          name="fileId"
          className={s.formItem}
          rules={[
            { required: true, message: 'Please select your project file!' },
          ]}
        >
          <Select>
            {getProjectFiles().map((f, i) => (
              <Option key={i} value={f.id}>
                {f.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {activeProject?.contractAddress!! && (
          <div className={`${s.contractAddress} wrap`}>
            <Link
              href={`https://testnet.tonscan.org/address/${activeProject?.contractAddress}`}
              target="_blank"
            >
              View Deployed Contract
            </Link>
          </div>
        )}

        <Button
          style={{ marginRight: '5px' }}
          type="primary"
          htmlType="submit"
          loading={isLoading == 'build'}
        >
          Compile
        </Button>
        <Button
          type="primary"
          loading={isLoading == 'deploy'}
          onClick={deploy}
          disabled={!buildOutput?.contractBOC}
        >
          Deploy
        </Button>
        <br />
        <br />
      </Form>

      {activeProject?.id && tonConnector && activeProject?.contractAddress && (
        <div className={s.contractInteraction}>
          <ContractInteraction
            contractAddress={activeProject?.contractAddress!!}
            projectId={projectId}
            abi={abi}
          />
        </div>
      )}
    </div>
  );
};

export default BuildProject;
