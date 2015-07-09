############################################################################
Summary: Renders source code as a syntax-highlighted PDF
Name: render50
Version: 1.8
Release: 0
License: GPLv2
Group: Applications/Productivity
Vendor: CS50
URL: https://manual.cs50.net/render50
BuildRoot: %{_tmppath}/%{name}-root
Requires: php >= 5.0.0, php-mbstring >= 5.0.0
BuildArch: noarch


############################################################################
%define _optdir /opt


############################################################################
# ensure RPM is portable by avoiding rpmlib(FileDigests)
# http://lists.rpm.org/pipermail/rpm-list/2009-October/000401.html
%global _binary_filedigest_algorithm 1
%global _source_filedigest_algorithm 1


############################################################################
# ensure RPM is portable by avoiding rpmlib(PayloadIsXz)
# http://www.cmake.org/pipermail/cmake/2010-March/035580.html
%global _binary_payload w9.gzdio


############################################################################
%description
CS50 Render is a command-line tool with which you can render
syntax-highlighted, landscape-mode PDFs of source code, ideal
for annotations.


############################################################################
%prep
rm -rf %{_builddir}/*
cp -a %{_sourcedir}/* %{_builddir}/


############################################################################
%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/%{name}
cp -a %{_builddir}/* %{buildroot}/
mkdir -p %{buildroot}%{_bindir}
ln -s /opt/%{name}/bin/%{name}.sh %{buildroot}%{_bindir}/%{name}


############################################################################
%clean
#/bin/rm -rf %{buildroot}


############################################################################
%files
%defattr(0644,root,root,0755)
%{_optdir}/%{name}/
%defattr(0755,root,root,0755)
%{_bindir}/%{name}
%{_optdir}/%{name}/bin
