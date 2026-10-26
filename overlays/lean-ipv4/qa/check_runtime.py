#!/usr/bin/env python3
"""Host fixture checks only. System commands are stubs; /proc is a temp directory."""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile

REPO=Path(__file__).resolve().parents[3]
OVERLAY=Path(__file__).resolve().parents[1]/'rootfs'
BASE=REPO/'analysis/verified/rootfs'
CLEARED=['TCSUPPORT_IPV6','TCSUPPORT_IPV6_ENHANCEMENT','TCSUPPORT_DSLITE','TCSUPPORT_6RD','TCSUPPORT_OPT212','TCSUPPORT_IPV6_ADVANCE','TCSUPPORT_IPV6_FIREWALL','TCSUPPORT_IPV6_FIREWALL_RFC2827','TCSUPPORT_IPV6_TELNET','TCSUPPORT_IPV6_TFTP','TCSUPPORT_IPV6_FTP','TCSUPPORT_IPV6_INETD','TCSUPPORT_MLD_SNOOPING','TCSUPPORT_MLD_PROXY']
PRESERVED=['TCSUPPORT_IGMP_QOS','TCSUPPORT_PORTBIND','TCSUPPORT_VLAN_TAG','TCSUPPORT_IGMP_PROXY_V3','TCSUPPORT_IGMP_PROXY_V3_OPEN','TCSUPPORT_IGMP_SNOOPING','TCSUPPORT_IGMP_SNOOPING_V3','TCSUPPORT_WLAN_IGMPSNOOP','TCSUPPORT_QOS','TCSUPPORT_RA_HWNAT']

def run(script,args=(),env=None):
    return subprocess.run(['bash','--posix',str(script),*map(str,args)],env=env,capture_output=True,text=True,timeout=5)

def main():
    results=[]
    for p in OVERLAY.rglob('*'):
        if p.is_file():subprocess.run(['sh','-n',str(p)],check=True,capture_output=True,text=True)
    profile=(OVERLAY/'userfs/profile.cfg').read_text()
    with tempfile.TemporaryDirectory(prefix='opendsl-ipv4-') as task_tmp:
        task_tmp=Path(task_tmp)
        p=task_tmp/'profile-test.sh';p.write_text('. '+shlex.quote(str(OVERLAY/'userfs/profile.cfg'))+'\n'+''.join(f'[ "${{{v}}}" = "" ] || exit 1\n' for v in CLEARED)+''.join(f'[ "${{{v}}}" = "y" ] || exit 2\n' for v in PRESERVED))
        r=run(p);assert r.returncode==0,r.stderr
        results.append('14 IPv6/MLD runtime flags empty; 10 IPTV/IPv4 driver and traffic-class flags remain enabled')
        rc=(OVERLAY/'usr/etc/init.d/rcS').read_text();base_rc=(BASE/'usr/etc/init.d/rcS').read_text()
        policy=re.search(r'\n# OpenDSL IPv4 runtime policy: begin\..*?# OpenDSL IPv4 runtime policy: end\.\n',rc,re.S);assert policy
        bootstate=re.search(r'# OpenDSL boot state neutralisation: begin\..*?# OpenDSL boot state neutralisation: end\.\n',rc,re.S);assert bootstate
        # the original rcS otherwise identical to stock apart from the two
        # marked OpenDSL blocks (recheck C03 adds the boot-state block)
        stripped=rc.replace(policy[0],'',1).replace(bootstate[0],'',1)
        assert stripped==base_rc, 'lean-ipv4 rcS differs from stock beyond the two marked OpenDSL blocks'
        assert rc.index(policy[0])>rc.index('mount -a\n')
        assert rc.index(policy[0])<rc.index('/userfs/bin/cfg_manager')
        proc=task_tmp/'proc'
        for scope in ['default','all']:
            d=proc/'sys/net/ipv6/conf'/scope;d.mkdir(parents=True)
            for field in ['disable_ipv6','accept_ra','autoconf']:(d/field).write_text('9\n')
        block=policy[0].replace('/proc/',str(proc)+'/')
        p=task_tmp/'sysctl-test.sh';p.write_text(block)
        r=run(p);assert r.returncode==0,r.stderr
        for scope in ['default','all']:
            for field,want in [('disable_ipv6','1'),('accept_ra','0'),('autoconf','0')]:assert (proc/'sys/net/ipv6/conf'/scope/field).read_text().strip()==want
        p.write_text(policy[0].replace('/proc/',str(task_tmp/'missing-proc')+'/'))
        assert run(p).returncode==0
        results.append('Early guarded sysctl writes set all/default disable=1, RA/autoconf=0; absent IPv6 proc tree is tolerated; original rcS otherwise identical')
        original_wan=(BASE/'usr/script/wan_start.sh').read_text()
        wan=(OVERLAY/'usr/script/wan_start.sh').read_text()
        stripped=re.sub(r'\n# OpenDSL IPv4 WAN policy: begin\.\n.*?# OpenDSL IPv4 WAN policy: end\.\n','',wan,flags=re.S)
        stripped=stripped.replace('\t# OpenDSL: keep custom PPP options but disable IPv6CP in this IPv4 profile.\n\tPPP_PARAM="$PPP_PARAM noipv6"\n','')
        assert stripped==original_wan
        for name in ['wan_start_ipv6.sh','ipv6rd_start.sh','dslite_start.sh']:
            text=(OVERLAY/'usr/script'/name).read_text()
            guard=re.search(r'\n# OpenDSL IPv4 runtime policy: begin\.\n.*?# OpenDSL IPv4 runtime policy: end\.\n',text,re.S)
            assert guard
            assert text.replace(guard[0],'',1)==(BASE/'usr/script'/name).read_text()
            testfile=task_tmp/name
            testfile.write_text(text.replace('/userfs/profile.cfg',str(OVERLAY/'userfs/profile.cfg')))
            # Exit happens before any original script arguments or network calls.
            assert run(testfile).returncode==0
        results.append('Separate IPv6/6RD/DS-Lite startup exits before original network changes; WAN script otherwise unchanged apart from IPv4/IPv6CP policy')
        # Exercise whole updated WAN script with fixture files and stubbed commands.
        for case,isp,version in [('pppoe-dual',2,'IPv4/IPv6'),('pppoe-v6',2,'IPv6'),('iptv-bridge',3,'IPv4/IPv6')]:
            root=task_tmp/case
            for d in ['userfs/bin','usr/script','usr/bin','sbin','bin','etc/ppp','var/run','var/tmp','proc/sys/net/ipv6/conf','tmp']:(root/d).mkdir(parents=True,exist_ok=True)
            (root/'userfs/profile.cfg').write_text(profile)
            (root/'etc/mac.conf').write_text('LAN_MAC=02:11:22:33:44:55\n')
            (root/'etc/dualwan.conf').write_text("wans_dualwan='dsl none'\n")
            pvc=1 if isp==3 else 0
            conf={'Active':'Yes','ISP':str(isp),'IPVERSION':version,'VPI':'8','VCI':'35','QOS':'nrt-vbr','PCR':'1200','SCR':'600','MBS':'32','ENCAP':'1483 Bridged Only LLC' if isp==3 else 'PPPoE LLC','USERNAME':'fixture-account','PASSWORD':'fixture-password','CONNECTION':'Connect_Keep_Alive','MTU':'1492','DEFAULTROUTE':'Yes','PPPGETIP':'Dynamic','AUTHEN':'CHAP','isIPTV':'Yes' if isp==3 else 'No','br_ifname':'br1','bridge_lan_port':'3','wan_pppoe_options':'lcp-echo-failure 8'}
            confpath=root/f'etc/isp{pvc}.conf';conftext=''.join(k+'='+shlex.quote(v)+'\n' for k,v in conf.items());confpath.write_text(conftext)
            trace=root/'trace';stub='#!/bin/sh\nprintf "%s\\n" "${0##*/} $*" >> "$TRACE"\nexit 0\n'
            for name in ['tcapi','ifconfig','ln','rc','ether_mac.sh','start_pppoe_relay.sh','wan_up','smuxctl','iptables','qoscmd','brctl','vconfig','br2684ctl','pppd','udhcpc','route','sleep']:
                for d in ['bin','sbin','usr/bin','userfs/bin','usr/script']:
                    p=root/d/name;p.write_text(stub);p.chmod(0o755)
            copy=wan
            # Relocate every absolute path namespace used by the WAN script.
            copy=re.sub(r'(?<![A-Za-z0-9_])/(userfs|usr|etc|var|proc|sbin|bin|tmp)(?=/)',lambda m:str(root)+'/'+m[1],copy)
            script=root/'wan.sh';script.write_text(copy)
            env={'PATH':str(root/'bin')+':/usr/bin:/bin','TRACE':str(trace)}
            r=run(script,[pvc],env)
            assert r.returncode==0,(case,r.stderr)
            assert not r.stderr,(case,r.stderr)
            log=trace.read_text()
            assert confpath.read_text()==conftext
            assert 'br2684ctl -c '+str(pvc)+' -e 0 -t nrt-vbr -p 1200 -q 600 -m 32 -a 0.8.35' in log,log
            if isp==2:
                ppp=next(line for line in log.splitlines() if line.startswith('pppd '))
                assert 'user fixture-account password fixture-password' in ppp
                assert 'mtu 1492 mru 1492' in ppp and 'lcp-echo-failure 8 noipv6' in ppp
                assert ' ipv6 ' not in ppp and ' noip ' not in ppp
            else:
                assert 'brctl addif br1 nas1' in log and 'brctl delif br0 elan.3' in log and 'brctl addif br1 elan.3' in log
                assert 'tcapi commit IPTV' in log # existing IPv4 IPTV activation, retained verbatim
                assert 'pppd ' not in log
            assert 'tcapi save' not in log
            results.append(case+': account/PVC/ATM QoS preserved; '+('IPv4 PPP and noipv6 enforced' if isp==2 else 'IPTV bridge port binding and native IPTV activation retained'))
    print(json.dumps({'scope':'Host shell fixtures and command stubs; no target hardware, daemons or real /proc writes','results':results},indent=2))

if __name__=='__main__':main()
